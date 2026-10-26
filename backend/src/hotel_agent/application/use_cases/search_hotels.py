import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.dto import GeoFeatureRecord, SearchHotelRecord
from hotel_agent.application.exploration_requests import apply_exploration, exploration_terms
from hotel_agent.application.facility_matching import facility_fact, facility_intent
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.nearby_matching import nearby_intent, nearby_key, nearby_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.application.search_evidence import best_facts, save_search_evidence
from hotel_agent.application.search_ranking import search_rank, view_eligible
from hotel_agent.application.spatial_matching import spatial_fact, spatial_intent
from hotel_agent.application.spatial_resolution import resolve_spatial_requests
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from hotel_agent.domain.errors import InvalidQuery
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import Scored, score


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchResult:
    hotel: SearchHotelRecord
    scored: Scored


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchOutcome:
    query_id: str
    parsed: ParsedQuery
    results: Sequence[SearchResult]
    question: str | None = None


class SearchHotels:
    def __init__(
        self,
        llm: LLMPort,
        uow: UnitOfWorkFactory,
        clock: ClockPort,
        place_lookup: PlaceLookupPort | None = None,
        explorer: DataExplorer | None = None,
        areas: SearchAreasPort | None = None,
        semantic: SemanticSearchPort | None = None,
        window_views: EvaluateWindowViews | None = None,
    ) -> None:
        self._llm = llm
        self._uow = uow
        self._clock = clock
        self._place_lookup = place_lookup
        self._explorer = explorer
        self._areas = areas
        self._semantic = semantic
        self._window_views = window_views

    async def __call__(
        self,
        query: str,
        region: str,
        bbox: tuple[float, float, float, float] | None,
        limit: int,
    ) -> SearchOutcome:
        if not query.strip():
            raise InvalidQuery("Search query is empty")
        parsed = await self._llm.parse_query(query)
        if parsed.nearby_objects or parsed.facility_requests or parsed.spatial_requests:
            parsed = replace(
                parsed,
                intents=parsed.intents
                + tuple(nearby_intent(request) for request in parsed.nearby_objects)
                + tuple(facility_intent(request) for request in parsed.facility_requests)
                + tuple(spatial_intent(request) for request in parsed.spatial_requests),
            )
        location = parsed.location_hint.strip() if parsed.location_hint else None
        if location and location.casefold() in {"россия", "russia"}:
            location = None
        if parsed.needs_clarification or (not location and not parsed.anywhere):
            parsed = replace(parsed, location_hint=location, needs_clarification=True)
            return _empty(query, region, bbox, parsed)
        candidates = await find_candidates(
            query,
            location,
            region,
            bbox,
            self._uow,
            self._areas,
            self._semantic,
            self._place_lookup,
        )
        if candidates.location_hint:
            location = candidates.location_hint
            parsed = replace(parsed, location_hint=location)
        region, bbox, hotels = candidates.region, candidates.bbox, candidates.hotels
        if candidates.unsupported:
            return _empty(query, region, bbox, replace(parsed, unsupported_region=location))
        explored = ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        if self._explorer is not None and exploration_terms(parsed):
            explored = await self._explorer(
                query,
                exploration_terms(parsed),
                location or "Россия",
                region,
                hotels,
                bbox,
                candidates.allow_expand,
                discovery_allowed=parsed.anywhere and location is None,
            )
            hotels, bbox = explored.hotels, explored.bbox
            parsed = apply_exploration(parsed, explored)
        async with self._uow() as uow:
            regions = tuple(dict.fromkeys(hotel.region_id for hotel in hotels)) or (region,)
            stored = [row for selected in regions for row in await uow.search.list_facts(selected)]
            spatial = await resolve_spatial_requests(
                uow, parsed.spatial_requests, location or "Россия", bbox, hotels
            )
            sea_positions = (
                await uow.coastlines.nearest_points(tuple(hotel.id for hotel in hotels))
                if any(request.kind == "sea_view" for request in parsed.spatial_requests)
                else {}
            )
            nearby = [
                (request, await uow.nearby_objects.list_matches(region, request, bbox))
                for request in parsed.nearby_objects
            ]
            supplier_content = (
                [
                    row
                    for selected in regions
                    for row in await uow.search.list_supplier_content(selected)
                ]
                if parsed.facility_requests
                else ()
            )
        spatial_bbox = bbox
        if spatial_bbox is None and hotels:
            spatial_bbox = (
                min(hotel.location[0] for hotel in hotels) - 0.1,
                min(hotel.location[1] for hotel in hotels) - 0.1,
                max(hotel.location[0] for hotel in hotels) + 0.1,
                max(hotel.location[1] for hotel in hotels) + 0.1,
            )
        if self._place_lookup is not None and spatial_bbox is not None:
            for index, (spatial_request, target) in enumerate(spatial):
                if target is not None or spatial_request.kind in {"city_center", "sea_view"}:
                    continue
                position = await self._place_lookup.coordinates(
                    spatial_request.target or "", spatial_bbox
                )
                if position is None:
                    continue
                async with self._uow() as uow:
                    place = await uow.named_places.near_coordinate(position, spatial_bbox)
                spatial[index] = (spatial_request, place)
        facts = best_facts((*stored, *explored.facts))
        evidence = list(explored.facts)
        features: list[GeoFeatureRecord] = []
        now = self._clock.now()
        if nearby:
            for request, matches in nearby:
                key = nearby_key(request)
                for hotel in hotels:
                    ids = matches.get(hotel.id, ())
                    nearby_evidence = nearby_record(hotel.id, key, request, ids, now)
                    evidence.append(nearby_evidence)
                    facts.setdefault(hotel.id, {})[key] = fact_from_record(nearby_evidence)
        for spatial_request, target in spatial:
            if spatial_request.kind in {"sea_view", "landmark_view"}:
                if self._window_views is not None:
                    targets = (
                        sea_positions
                        if spatial_request.kind == "sea_view"
                        else {hotel.id: target for hotel in hotels if target is not None}
                    )
                    evaluated = await self._window_views(hotels, spatial_request, targets, now)
                    features.extend(evaluated.features)
                    evidence.extend(evaluated.facts)
                    for row in evaluated.facts:
                        facts.setdefault(row.hotel_id, {})[row.characteristic_key] = (
                            fact_from_record(row)
                        )
                continue
            if target is None:
                continue
            for hotel in hotels:
                spatial_record = spatial_fact(spatial_request, hotel, target, now)
                evidence.append(spatial_record)
                facts.setdefault(hotel.id, {})[spatial_record.characteristic_key] = (
                    fact_from_record(spatial_record)
                )
        for facility_request in parsed.facility_requests:
            for content in supplier_content:
                record = facility_fact(facility_request, content)
                if record is not None:
                    evidence.append(record)
                    facts.setdefault(content.hotel_id, {})[record.characteristic_key] = (
                        fact_from_record(record)
                    )
        ranked = [
            SearchResult(hotel=hotel, scored=score(parsed.intents, facts.get(hotel.id, {}), now))
            for hotel in hotels
        ]
        if parsed.intents:
            ranked = [
                item
                for item in ranked
                if not item.scored.disqualified and view_eligible(item.scored)
            ]
            ranked.sort(key=lambda item: search_rank(item.hotel, item.scored))
        else:
            ranked.sort(
                key=lambda item: (
                    item.hotel.name == item.hotel.id,
                    item.hotel.name.startswith("#"),
                    item.hotel.name.casefold(),
                )
            )
        if parsed.anywhere and (parsed.intents or parsed.unmatched_terms):
            ranked = [item for item in ranked if item.scored.score > 0]
        await save_search_evidence(
            self._uow, evidence, [r.hotel.id for r in ranked[:limit]], features
        )
        fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
        return SearchOutcome(
            query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
            parsed=parsed,
            results=() if explored.question else ranked[:limit],
            question=explored.question,
        )


def _empty(
    query: str,
    region: str,
    bbox: tuple[float, float, float, float] | None,
    parsed: ParsedQuery,
) -> SearchOutcome:
    fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
    return SearchOutcome(
        query_id=hashlib.sha256(fingerprint).hexdigest()[:16], parsed=parsed, results=()
    )
