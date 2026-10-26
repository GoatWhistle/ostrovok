import asyncio
from collections.abc import Mapping, Sequence

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
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.domain.query import ParsedQuery


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
    ) -> None:
        self._llm, self._uow, self._terrain = llm, uow, terrain
        self._clock, self._logger = clock, logger
        self._country_scope = country_scope
        self._semantic = semantic
        self._web, self._conditions, self._view = web, conditions, view
        self._offers, self._catalog = offers, catalog
        self._places = places

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
        outcomes = []
        note = research_note(feedback)
        previous_tools: DataTools | None = None
        candidates = tuple(hotels)
        deadline = asyncio.get_running_loop().time() + 600
        for term in dict.fromkeys(terms):
            tools = DataTools(
                self._uow,
                self._terrain,
                candidates,
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
            )
            if previous_tools is not None:
                tools.research.reuse(previous_tools.research)
            previous_tools = tools
            remaining = max(0, deadline - asyncio.get_running_loop().time())
            loop = WishLoop(self._llm, self._clock, self._logger, timeout_s=min(180, remaining))
            outcome = await loop.run(query, term, tools, note)
            outcomes.append(outcome)
            candidates = tuple({h.id: h for h in (*candidates, *outcome.hotels)}.values())
            bbox = outcome.bbox
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
