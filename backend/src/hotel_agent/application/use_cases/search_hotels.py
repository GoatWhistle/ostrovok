import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.facility_matching import facility_fact, facility_intent
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.geographic_extent import intersection
from hotel_agent.application.nearby_matching import nearby_intent, nearby_key, nearby_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.spatial_matching import spatial_fact, spatial_intent
from hotel_agent.application.spatial_resolution import resolve_spatial_requests
from hotel_agent.domain.entities import Fact
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
    ) -> None:
        self._llm = llm
        self._uow = uow
        self._clock = clock
        self._place_lookup = place_lookup
        self._explorer = explorer
        self._areas = areas

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
        allow_expand = bbox is None
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
        if parsed.needs_clarification or not location:
            parsed = replace(parsed, location_hint=location, needs_clarification=True)
            return _empty(query, region, bbox, parsed)
        area = self._areas.resolve(location) if self._areas else None
        allow_expand = allow_expand and area is None
        async with self._uow() as uow:
            if location.casefold() in {"сочи", "sochi", "адлер", "adler"}:
                region = "sochi"
            else:
                region = "russia"
                city_bbox = area.bbox if area else await uow.regions.city_bbox(location)
                if city_bbox is None:
                    parsed = replace(parsed, unsupported_region=location)
                    return _empty(query, region, bbox, parsed)
                if bbox is not None:
                    overlap = intersection(bbox, city_bbox)
                    if overlap is None:
                        return _empty(query, region, bbox, parsed)
                    bbox = overlap
                else:
                    bbox = city_bbox
            hotels = await uow.search.list_hotels(region, bbox)
            if area:
                hotels = [hotel for hotel in hotels if area.contains(hotel.location)]
        explored = ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        if self._explorer is not None and parsed.unmatched_terms:
            explored = await self._explorer(
                query, parsed.unmatched_terms, location, region, hotels, bbox, allow_expand
            )
            hotels, bbox = explored.hotels, explored.bbox
            parsed = replace(
                parsed,
                intents=parsed.intents + explored.intents,
                unmatched_terms=tuple(
                    term for term in parsed.unmatched_terms if term not in explored.resolved_terms
                ),
                needs_clarification=bool(explored.question),
            )
        async with self._uow() as uow:
            stored = await uow.search.list_facts(region)
            spatial = await resolve_spatial_requests(
                uow, parsed.spatial_requests, location, bbox, hotels
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
                await uow.search.list_supplier_content(region) if parsed.facility_requests else ()
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
        facts = _best_facts((*stored, *explored.facts))
        now = self._clock.now()
        if nearby:
            for request, matches in nearby:
                key = nearby_key(request)
                for hotel in hotels:
                    ids = matches.get(hotel.id, ())
                    facts.setdefault(hotel.id, {})[key] = fact_from_record(
                        nearby_record(hotel.id, key, request, ids, now)
                    )
        for spatial_request, target in spatial:
            if spatial_request.kind == "sea_view":
                for hotel in hotels:
                    coast = sea_positions.get(hotel.id)
                    if coast is not None:
                        sea_record = spatial_fact(spatial_request, hotel, coast, now)
                        facts.setdefault(hotel.id, {})[sea_record.characteristic_key] = (
                            fact_from_record(sea_record)
                        )
                continue
            if target is None:
                continue
            for hotel in hotels:
                spatial_record = spatial_fact(spatial_request, hotel, target, now)
                facts.setdefault(hotel.id, {})[spatial_record.characteristic_key] = (
                    fact_from_record(spatial_record)
                )
        for facility_request in parsed.facility_requests:
            for content in supplier_content:
                record = facility_fact(facility_request, content)
                if record is not None:
                    facts.setdefault(content.hotel_id, {})[record.characteristic_key] = (
                        fact_from_record(record)
                    )
        ranked = [
            SearchResult(hotel=hotel, scored=score(parsed.intents, facts.get(hotel.id, {}), now))
            for hotel in hotels
        ]
        if parsed.intents:
            ranked = [item for item in ranked if not item.scored.disqualified]
            ranked.sort(
                key=lambda item: (
                    -item.scored.score,
                    item.hotel.name == item.hotel.id,
                    item.hotel.name.startswith("#"),
                    item.hotel.name.casefold(),
                )
            )
        else:
            ranked.sort(
                key=lambda item: (
                    item.hotel.name == item.hotel.id,
                    item.hotel.name.startswith("#"),
                    item.hotel.name.casefold(),
                )
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


def _best_facts(rows: Sequence[SearchFactRecord]) -> dict[str, dict[str, Fact]]:
    grouped: dict[str, dict[str, Fact]] = {}
    for row in rows:
        current = grouped.setdefault(row.hotel_id, {})
        fact = fact_from_record(row)
        old = current.get(row.characteristic_key)
        if old is None or (
            row.characteristic_key == "noise_level"
            and isinstance(fact.value, int | float)
            and isinstance(old.value, int | float)
            and fact.value < old.value
        ):
            current[row.characteristic_key] = fact
    return grouped
