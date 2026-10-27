import asyncio
from collections.abc import Mapping, Sequence

from hotel_agent.application import progress
from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.review_feedback import ReviewFeedback, research_note
from hotel_agent.application.agent.view_consistency import reconcile_views
from hotel_agent.application.agent.wish_loop import WishLoop
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.hotel_catalog import HotelCatalogSource
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.place_research import PlaceResearchPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.requested_evidence import RequestedEvidencePort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.use_cases.get_hotel_details import GetHotelDetails
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.domain.query import ParsedQuery

WISHES_AT_ONCE = 3
WISH_TIMEOUT_S = 90.0


class DataExplorer:
    def __init__(
        self,
        llm: LLMPort,
        uow: UnitOfWorkFactory,
        terrain: TerrainMeasurementPort,
        clock: ClockPort,
        logger: LoggerPort,
        country_scope: GeographicScopePort | None = None,
        semantic: SemanticSearchPort | None = None,
        web: WebResearchPort | None = None,
        conditions: DestinationConditionsPort | None = None,
        view: ViewAssessmentPort | None = None,
        offers: GetHotelOffers | None = None,
        catalog: HotelCatalogSource | None = None,
        places: Mapping[str, PlaceResearchPort] | None = None,
        details: GetHotelDetails | None = None,
    ) -> None:
        self._llm, self._uow, self._terrain = llm, uow, terrain
        self._clock, self._logger = clock, logger
        self._country_scope = country_scope
        self._semantic = semantic
        self._web, self._conditions, self._view = web, conditions, view
        self._offers, self._catalog = offers, catalog
        self._places, self._details = places, details

    async def __call__(
        self,
        query: str,
        terms: tuple[str, ...],
        city: str,
        region: str,
        hotels: Sequence[SearchHotelRecord],
        bbox: tuple[float, float, float, float] | None,
        allow_expand: bool,
        discovery_allowed: bool = False,
        native: RequestedEvidencePort | None = None,
        parsed: ParsedQuery | None = None,
        feedback: Sequence[ReviewFeedback] = (),
    ) -> ExplorationOutcome:
        if not terms:
            return ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        note = research_note(feedback)
        started = asyncio.get_running_loop().time()
        prepared: list[tuple[str, DataTools]] = []
        for term in dict.fromkeys(terms):
            tools = DataTools(
                self._uow,
                self._terrain,
                tuple(hotels),
                city,
                region,
                bbox,
                allow_expand,
                self._country_scope,
                self._semantic,
                discovery_allowed,
                DocumentEvidence(self._llm, (term,), query),
                self._web,
                self._conditions,
                self._clock.now(),
                self._view,
                self._offers,
                (term,),
                native,
                self._catalog,
                parsed,
                places=self._places,
                llm=self._llm,
                details=self._details,
            )
            if prepared:
                tools.research.share(prepared[0][1].research)
            prepared.append((term, tools))
        gate = asyncio.Semaphore(WISHES_AT_ONCE)

        async def explore(term: str, tools: DataTools) -> ExplorationOutcome:
            async with gate:
                spent = asyncio.get_running_loop().time() - started
                loop = WishLoop(
                    self._llm,
                    self._clock,
                    self._logger,
                    timeout_s=max(1.0, WISH_TIMEOUT_S - spent),
                )
                outcome = await loop.run(query, term, tools, note)
                progress.step(
                    "wish",
                    term=term,
                    status=str(outcome.wish_results[0].status)
                    if outcome.wish_results
                    else "incomplete",
                )
                return outcome

        outcomes = list(await asyncio.gather(*(explore(term, t) for term, t in prepared)))
        candidates = tuple(
            {
                hotel.id: hotel
                for hotel in (*hotels, *(row for item in outcomes for row in item.hotels))
            }.values()
        )
        bbox = widest(bbox, tuple(item.bbox for item in outcomes))
        outcomes = reconcile_views(outcomes)
        questions = tuple(dict.fromkeys(item.question for item in outcomes if item.question))
        return ExplorationOutcome(
            hotels=candidates,
            bbox=bbox,
            intents=tuple(intent for item in outcomes for intent in item.intents),
            facts=tuple(row for item in outcomes for row in item.facts),
            resolved_terms=tuple(term for item in outcomes for term in item.resolved_terms),
            processed_terms=tuple(term for item in outcomes for term in item.processed_terms),
            features=tuple(feature for item in outcomes for feature in item.features),
            wish_results=tuple(result for item in outcomes for result in item.wish_results),
            question=" ".join(questions) if questions else None,
        )


def widest(
    initial: tuple[float, float, float, float] | None,
    boxes: Sequence[tuple[float, float, float, float] | None],
) -> tuple[float, float, float, float] | None:
    known = [box for box in (initial, *boxes) if box is not None]
    if not known:
        return None
    return (
        min(box[0] for box in known),
        min(box[1] for box in known),
        max(box[2] for box in known),
        max(box[3] for box in known),
    )
