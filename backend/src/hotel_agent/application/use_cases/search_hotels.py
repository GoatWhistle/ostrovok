import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.requested_tools import RequestedTools
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.agent.wish_records import WishResult
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.exploration_requests import apply_exploration, exploration_terms
from hotel_agent.application.facility_matching import facility_intent
from hotel_agent.application.nearby_matching import nearby_intent
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.application.search_evidence import best_facts, save_search_evidence
from hotel_agent.application.search_ranking import search_rank, view_eligible
from hotel_agent.application.spatial_matching import spatial_intent
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
    wish_results: tuple[WishResult, ...] = ()
    review: ReviewResult | None = None


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
        review: RecommendationReview | None = None,
    ) -> None:
        self._llm = llm
        self._uow = uow
        self._clock = clock
        self._place_lookup = place_lookup
        self._explorer = explorer
        self._areas = areas
        self._semantic = semantic
        self._window_views = window_views
        self._review = review

    async def __call__(
        self, query: str, region: str, bbox: tuple[float, float, float, float] | None, limit: int
    ) -> SearchOutcome:
        if not query.strip():
            raise InvalidQuery("Search query is empty")
        parsed = await self._llm.parse_query(query)
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
            return _empty(
                query,
                region,
                bbox,
                replace(parsed, location_hint=location, needs_clarification=True),
            )
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
        native = RequestedTools(
            parsed,
            location or "Россия",
            region,
            self._uow,
            self._clock,
            self._place_lookup,
            self._window_views,
        )
        terms = exploration_terms(parsed)
        explored = ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        if self._explorer is not None and terms:
            explored = await self._explorer(
                query,
                terms,
                location or "Россия",
                region,
                hotels,
                bbox,
                candidates.allow_expand,
                discovery_allowed=parsed.anywhere and location is None,
                native=native,
                parsed=parsed,
            )
            parsed = apply_exploration(parsed, explored)
        elif terms:
            collected = [await native.check(term, hotels, bbox) for term in terms]
            explored = ExplorationOutcome(
                hotels=tuple(hotels),
                bbox=bbox,
                facts=tuple(row for item in collected for row in item.facts),
                features=tuple(feature for item in collected for feature in item.features),
            )
        hotels, bbox = explored.hotels, explored.bbox
        facts = best_facts(explored.facts)
        now = self._clock.now()
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
        if parsed.anywhere and (parsed.intents or parsed.unmatched_terms):
            ranked = [item for item in ranked if item.scored.score > 0]
        if explored.question:
            ranked = [item for item in ranked if item.scored.score > 0]
        report = None
        if self._review is not None:
            report = await self._review.check(
                query, parsed, [(item.hotel, item.scored) for item in ranked], limit
            )
            ranked = [item for item in ranked if item.hotel.id in report.accepted_ids]
        selected = ranked[:limit]
        await save_search_evidence(
            self._uow, explored.facts, [item.hotel.id for item in selected], explored.features
        )
        fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
        return SearchOutcome(
            query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
            parsed=parsed,
            results=selected,
            question=explored.question,
            wish_results=explored.wish_results,
            review=report,
        )


def _empty(
    query: str, region: str, bbox: tuple[float, float, float, float] | None, parsed: ParsedQuery
) -> SearchOutcome:
    fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
    return SearchOutcome(
        query_id=hashlib.sha256(fingerprint).hexdigest()[:16], parsed=parsed, results=()
    )
