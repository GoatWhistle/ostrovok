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
from hotel_agent.application.room_view_corroboration import corroborate_room_views
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.application.search_evidence import save_search_evidence
from hotel_agent.application.search_preview import search_preview
from hotel_agent.application.search_progress import report_candidates, understood
from hotel_agent.application.search_selection import (
    Rejection,
    Selection,
    nearest_matches,
    not_shown,
    select_candidates,
)
from hotel_agent.application.spatial_matching import spatial_intent
from hotel_agent.application.stay_guests import catalog_capacity, researched, stay_guests
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from hotel_agent.domain.errors import InvalidQuery
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import Scored


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchResult:
    hotel: SearchHotelRecord
    scored: Scored


@dataclass(frozen=True, slots=True, kw_only=True)
class AskedHotelier:
    hotel_id: str
    characteristic_key: str
    question_id: str


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchOutcome:
    query_id: str
    parsed: ParsedQuery
    results: Sequence[SearchResult]
    question: str | None = None
    wish_results: tuple[WishResult, ...] = ()
    rejected: tuple[Rejection, ...] = ()
    asked: tuple[AskedHotelier, ...] = ()
    review: ReviewResult | None = None


COUNTRY_NAMES = frozenset({"россия", "russia"})


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
        parsed = stay_guests(parsed)
        location = parsed.location_hint.strip() if parsed.location_hint else None
        if location and location.casefold() in COUNTRY_NAMES:
            location = None
            parsed = replace(parsed, anywhere=True, needs_clarification=False)
        progress.step("parsed", **understood(parsed, location))
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
        nearby_request = next(
            (
                r
                for r in parsed.nearby_objects
                if r.name and location and r.name.casefold() == location.casefold()
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
            nearby_request,
        )
        if candidates.location_hint:
            location = candidates.location_hint
            parsed = replace(parsed, location_hint=location)
        region, bbox, hotels = candidates.region, candidates.bbox, candidates.hotels
        report_candidates(candidates, location)
        if candidates.unsupported:
            return _empty(query, region, bbox, replace(parsed, unsupported_region=location))
        parsed, capacity = await catalog_capacity(self._uow, parsed, hotels)
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
        plan = exploration_plan(researched(parsed))
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

        async with search_preview(
            parsed, hotels, region, bbox, self._uow, self._geographic_objects
        ) as (
            preview,
            preview_task,
        ):

            async def select(parsed: ParsedQuery, explored: ExplorationOutcome) -> Selection:
                return await select_candidates(
                    query,
                    parsed,
                    explored,
                    self._clock.now(),
                    self._review,
                    limit,
                    preview.prioritizer(parsed, region, bbox, self._uow),
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
            explored = replace(explored, facts=explored.facts + capacity)
            progress.step("review", candidates=len(explored.hotels))
            await preview_task
            selection = await select(parsed, explored)
            feedback = rejection_feedback(selection.ranked, selection.report)
            if feedback and explorer is not None and terms and not explored.question:
                doubted = tuple(
                    term for term in terms if any(term in row.wishes for row in feedback)
                )
                retried = merge_exploration(explored, await explore(feedback, doubted or terms))
                retried_parsed = apply_exploration(parsed, retried, plan.duplicates)
                attempt = await select(retried_parsed, retried)
                if attempt.accepted:
                    explored, parsed, selection = retried, retried_parsed, attempt
            score = max((scored.score for _, scored in selection.accepted), default=0)
            finalists = [hotel for hotel, scored in selection.accepted if scored.score == score]
            await preview.calculate(parsed, finalists, region, bbox, self._uow, prune=True)
            accepted = preview.finish(selection.accepted)
            chosen = accepted or nearest_matches(selection.ranked, limit)
            results = [SearchResult(hotel=hotel, scored=scored) for hotel, scored in chosen[:limit]]
            selected_ids = [item.hotel.id for item in results]
            async with self._uow() as uow:
                rooms = await uow.search.list_rooms_by_hotels(selected_ids)
            found = corroborate_room_views(
                tuple(row for row in explored.facts if row not in capacity), rooms
            )
            await save_search_evidence(self._uow, found, selected_ids, explored.features)
            asked = await self._asked(results, parsed)
            fingerprint = f"{query}\x00{region}\x00{explored.bbox}".encode()
            return SearchOutcome(
                query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
                parsed=parsed,
                results=results,
                question=explored.question,
                wish_results=explored.wish_results,
                review=selection.report,
                rejected=not_shown(selection.rejected, {item.hotel.id for item in results}),
                asked=asked,
            )

    async def _asked(
        self, results: Sequence[SearchResult], parsed: ParsedQuery
    ) -> tuple[AskedHotelier, ...]:
        unknown = {
            (item.hotel.id, match.intent.characteristic_key)
            for item in results
            for match in item.scored.matches
            if match.fact is None
        }
        if not unknown:
            return ()
        async with self._uow() as uow:
            records = await uow.questions.open_for(
                sorted({hotel for hotel, _ in unknown}), sorted({key for _, key in unknown})
            )
        return tuple(
            AskedHotelier(
                hotel_id=record.hotel_id,
                characteristic_key=record.characteristic_key,
                question_id=record.id,
            )
            for record in records
            if (record.hotel_id, record.characteristic_key) in unknown
        )


def _empty(
    query: str, region: str, bbox: tuple[float, float, float, float] | None, parsed: ParsedQuery
) -> SearchOutcome:
    fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
    return SearchOutcome(
        query_id=hashlib.sha256(fingerprint).hexdigest()[:16], parsed=parsed, results=()
    )
