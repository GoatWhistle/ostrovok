import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace

from hotel_agent.application import progress
from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.requested_tools import RequestedTools
from hotel_agent.application.agent.review_feedback import ReviewFeedback, rejection_feedback
from hotel_agent.application.agent.semantic_review import ReviewResult, SemanticReview
from hotel_agent.application.agent.wish_records import WishResult
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.exploration_requests import (
    apply_exploration,
    exploration_plan,
    merge_exploration,
)
from hotel_agent.application.facility_matching import facility_intent
from hotel_agent.application.landmark_resolution import LandmarkResolver
from hotel_agent.application.nearby_matching import nearby_intent
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.geographic_objects import GeographicObjectsPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.application.search_evidence import save_search_evidence
from hotel_agent.application.search_selection import Selection, nearest_matches, select_candidates
from hotel_agent.application.spatial_matching import spatial_intent
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from hotel_agent.domain.errors import InvalidQuery
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import Scored


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
        landmark_review: SemanticReview | None = None,
        geographic_objects: GeographicObjectsPort | None = None,
    ) -> None:
        self._geographic_objects = geographic_objects
        self._llm = llm
        self._uow = uow
        self._clock = clock
        self._place_lookup = place_lookup
        self._explorer = explorer
        self._areas = areas
        self._semantic = semantic
        self._window_views = window_views
        self._review = review
        self._landmark_review = landmark_review

    async def __call__(
        self, query: str, region: str, bbox: tuple[float, float, float, float] | None, limit: int
    ) -> SearchOutcome:
        if not query.strip():
            raise InvalidQuery("Search query is empty")
        progress.step("parsing")
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
        progress.step("parsed", **_understood(parsed, location))
        if parsed.needs_clarification or (not location and not parsed.anywhere):
            return _empty(
                query,
                region,
                bbox,
                replace(parsed, location_hint=location, needs_clarification=True),
            )
        landmarks = (
            LandmarkResolver(self._uow, self._landmark_review, self._areas)
            if self._landmark_review
            else None
        )
        location_request = next(
            (
                r
                for r in parsed.spatial_requests
                if r.target and location and r.target.casefold() == location.casefold()
            ),
            None,
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
            self._geographic_objects,
            landmarks,
            location_request,
        )
        if candidates.location_hint:
            location = candidates.location_hint
            parsed = replace(parsed, location_hint=location)
        region, bbox, hotels = candidates.region, candidates.bbox, candidates.hotels
        progress.step("candidates", found=len(hotels), region=region)
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
            landmarks,
            self._geographic_objects,
        )
        plan = exploration_plan(parsed)
        terms = plan.terms
        explored = ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        explorer = self._explorer

        async def explore(
            feedback: tuple[ReviewFeedback, ...], wanted: tuple[str, ...] = terms
        ) -> ExplorationOutcome:
            if explorer is None:
                return explored
            return await explorer(
                query,
                wanted,
                location or "Россия",
                region,
                hotels,
                bbox,
                candidates.allow_expand,
                discovery_allowed=parsed.anywhere and location is None,
                native=native,
                parsed=parsed,
                feedback=feedback,
            )

        progress.step("research", wishes=len(terms))
        if explorer is not None and terms:
            explored = await explore(())
            parsed = apply_exploration(parsed, explored, plan.duplicates)
        elif terms:
            collected = [await native.check(term, hotels, bbox) for term in terms]
            explored = ExplorationOutcome(
                hotels=tuple(hotels),
                bbox=bbox,
                facts=tuple(row for item in collected for row in item.facts),
                features=tuple(feature for item in collected for feature in item.features),
            )
        progress.step("review", candidates=len(explored.hotels))
        selection = await self._selection(query, parsed, explored, limit)
        feedback = rejection_feedback(selection.ranked, selection.report)
        if feedback and explorer is not None and terms and not explored.question:
            doubted = tuple(term for term in terms if any(term in row.wishes for row in feedback))
            retried = merge_exploration(explored, await explore(feedback, doubted or terms))
            retried_parsed = apply_exploration(parsed, retried, plan.duplicates)
            attempt = await self._selection(query, retried_parsed, retried, limit)
            if attempt.accepted:
                explored, parsed, selection = retried, retried_parsed, attempt
        chosen = selection.accepted or nearest_matches(selection.ranked, limit)
        results = [SearchResult(hotel=hotel, scored=scored) for hotel, scored in chosen[:limit]]
        await save_search_evidence(
            self._uow, explored.facts, [item.hotel.id for item in results], explored.features
        )
        fingerprint = f"{query}\x00{region}\x00{explored.bbox}".encode()
        return SearchOutcome(
            query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
            parsed=parsed,
            results=results,
            question=explored.question,
            wish_results=explored.wish_results,
            review=selection.report,
        )

    async def _selection(
        self, query: str, parsed: ParsedQuery, explored: ExplorationOutcome, limit: int
    ) -> Selection:
        return await select_candidates(
            query, parsed, explored, self._clock.now(), self._review, limit
        )


def _understood(parsed: ParsedQuery, location: str | None) -> dict[str, object]:
    return {
        "location": location,
        "intents": [
            {"term": intent.source_text.strip(), "key": intent.characteristic_key}
            for intent in parsed.intents
            if intent.source_text.strip()
        ],
        "check_in": parsed.check_in.isoformat() if parsed.check_in else None,
        "check_out": parsed.check_out.isoformat() if parsed.check_out else None,
        "adults": parsed.adults,
    }


def _empty(
    query: str, region: str, bbox: tuple[float, float, float, float] | None, parsed: ParsedQuery
) -> SearchOutcome:
    fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
    return SearchOutcome(
        query_id=hashlib.sha256(fingerprint).hexdigest()[:16], parsed=parsed, results=()
    )
