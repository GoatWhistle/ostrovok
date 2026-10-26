import asyncio
import json
from collections.abc import Sequence
from dataclasses import replace
from typing import Any

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.measurement_scope import (
    needs_scope_check,
    verify_measurement_scope,
)
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
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
        web: WebResearchPort | None = None,
        conditions: DestinationConditionsPort | None = None,
        view: ViewAssessmentPort | None = None,
        offers: GetHotelOffers | None = None,
    ) -> None:
        self._llm, self._uow, self._terrain = llm, uow, terrain
        self._clock, self._logger = clock, logger
        self._country_scope = country_scope
        self._semantic = semantic
        self._web, self._conditions, self._view = web, conditions, view
        self._offers = offers

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
            self._web,
            self._conditions,
            self._clock.now(),
            self._view,
            self._offers,
            terms,
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
                tool_calls = 0
                for index in range(7):
                    context = json.dumps(
                        {
                            "now": self._clock.now().isoformat(),
                            "query": query,
                            "terms": terms,
                            "city": city,
                            "candidate_count": len(tools.hotels),
                            "bbox": tools.bbox,
                            "allow_expand": allow_expand,
                            "discovery_allowed": discovery_allowed,
                            "remaining_steps": 7 - index,
                            "remaining_tool_calls": max(0, 5 - tool_calls),
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
                        check_fields=",".join(
                            check.field for criterion in step.criteria for check in criterion.checks
                        ),
                    )
                    if step.criteria and not needs_scope_check(step.criteria):
                        candidate = materialize(
                            query, terms, step.criteria, tools, self._clock.now(), step.question
                        )
                        if candidate.intents:
                            retained = candidate
                    invalid_fields = {
                        check.field
                        for criterion in step.criteria
                        for check in criterion.checks
                        if check.field not in tools.descriptions
                    }
                    if step.action == "finish" and invalid_fields:
                        observations.append(
                            {
                                "tool": "validate_criteria",
                                "result": {
                                    "error": "Use only metric fields already returned by tools",
                                    "invalid_fields": sorted(invalid_fields),
                                    "fields": tools.descriptions,
                                },
                            }
                        )
                        continue
                    if step.action == "finish":
                        verified, rejected = await verify_measurement_scope(
                            self._llm, query, step.criteria, tools, self._clock.now()
                        )
                        if rejected and index < 6:
                            observations.append(
                                {
                                    "tool": "verify_measurement_scope",
                                    "result": {
                                        "error": "Measurements do not establish the requested date/time/scope. Recheck tool arguments; for right now use at=null, not noon.",
                                        "rejected_terms": rejected,
                                        "now": self._clock.now().isoformat(),
                                    },
                                }
                            )
                            continue
                        step = replace(step, criteria=verified)
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
                    if tool_calls >= 5:
                        observations.append(
                            {
                                "tool": "budget",
                                "result": {
                                    "error": "No tool calls remain. Finish using observed fields or report unknowns."
                                },
                            }
                        )
                        continue
                    tool_calls += 1
                    try:
                        result = await tools.execute(step.action, step.arguments)
                    except (ValueError, TypeError, KeyError) as error:
                        result = {"error": str(error)}
                    self._logger.info(
                        "data_agent_tool_result",
                        action=step.action,
                        error=str(result.get("error", "")),
                        metric_fields=",".join(result.get("fields", {})),
                        field=str(result.get("field", "")),
                    )
                    observations.append(
                        {"tool": step.action, "arguments": step.arguments, "result": result}
                    )
                    if step.criteria and not needs_scope_check(step.criteria):
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
