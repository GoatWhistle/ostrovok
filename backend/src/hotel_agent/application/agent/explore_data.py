import asyncio
import json
from collections.abc import Sequence
from typing import Any

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.domain.errors import ModelFailure


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
    ) -> None:
        self._llm, self._uow, self._terrain = llm, uow, terrain
        self._clock, self._logger = clock, logger
        self._country_scope = country_scope
        self._semantic = semantic

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
    ) -> ExplorationOutcome:
        fallback = ExplorationOutcome(hotels=tuple(hotels), bbox=bbox)
        if not terms or not hotels:
            return fallback
        tools = DataTools(
            self._uow,
            self._terrain,
            hotels,
            city,
            region,
            bbox,
            allow_expand,
            self._country_scope,
            self._semantic,
            discovery_allowed,
            DocumentEvidence(self._llm, terms),
        )
        observations: list[dict[str, Any]] = []
        retained = fallback
        try:
            async with asyncio.timeout(85):
                observations.append(
                    {
                        "tool": "inspect_data",
                        "arguments": {},
                        "result": await tools.execute("inspect_data", {}),
                    }
                )
                for index in range(5):
                    context = json.dumps(
                        {
                            "query": query,
                            "terms": terms,
                            "city": city,
                            "candidate_count": len(tools.hotels),
                            "bbox": tools.bbox,
                            "allow_expand": allow_expand,
                            "discovery_allowed": discovery_allowed,
                            "remaining_steps": 5 - index,
                            "observations": observations,
                        },
                        ensure_ascii=False,
                    )
                    step = await self._llm.explore_data(context)
                    self._logger.info(
                        "data_agent_step",
                        action=step.action,
                        argument_keys=",".join(sorted(step.arguments)),
                        step=index + 1,
                        hotel_count=len(tools.hotels),
                        criteria=len(step.criteria),
                    )
                    if step.criteria:
                        candidate = materialize(
                            query, terms, step.criteria, tools, self._clock.now(), step.question
                        )
                        if candidate.intents:
                            retained = candidate
                    if step.action == "finish":
                        outcome = materialize(
                            query, terms, step.criteria, tools, self._clock.now(), step.question
                        )
                        self._logger.info(
                            "data_agent_finished",
                            criteria=len(outcome.intents),
                            fact_count=len(outcome.facts),
                        )
                        if outcome.intents:
                            return outcome
                        if retained.intents:
                            return retained
                        return ExplorationOutcome(
                            hotels=tuple(hotels), bbox=bbox, question=step.question
                        )
                    try:
                        result = await tools.execute(step.action, step.arguments)
                    except (ValueError, TypeError, KeyError) as error:
                        result = {"error": str(error)}
                    observations.append(
                        {"tool": step.action, "arguments": step.arguments, "result": result}
                    )
                    if step.criteria:
                        candidate = materialize(
                            query, terms, step.criteria, tools, self._clock.now(), None
                        )
                        if candidate.intents:
                            retained = candidate
        except (TimeoutError, ModelFailure) as error:
            self._logger.warning(
                "data_agent_unavailable", cause=type(error).__name__, detail=str(error)
            )
        return retained
