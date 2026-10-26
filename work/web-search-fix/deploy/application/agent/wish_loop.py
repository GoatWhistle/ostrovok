import asyncio
from dataclasses import replace
from typing import Any

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_context import wish_context
from hotel_agent.application.agent.wish_criteria import evaluate_criteria
from hotel_agent.application.agent.wish_evidence import relabel_facts, wish_intent
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.agent.wish_outcomes import WishCompletion
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure


class WishLoop:
    def __init__(
        self,
        llm: LLMPort,
        clock: ClockPort,
        logger: LoggerPort,
        max_steps: int = 32,
        timeout_s: float = 180,
    ) -> None:
        self._llm, self._clock, self._logger = llm, clock, logger
        self._max_steps, self._timeout = max_steps, timeout_s

    async def run(self, query: str, term: str, tools: DataTools) -> ExplorationOutcome:
        ledger = WishLedger(tools.sources)
        completion = WishCompletion(self._clock, self._logger, term, ledger, tools)
        observations: list[dict[str, Any]] = []
        retained = ExplorationOutcome(hotels=tools.hotels, bbox=tools.bbox)
        reason = "Поиск пожелания не завершён; это не означает отсутствие подходящих отелей."
        status = WishStatus.INCOMPLETE
        question = None
        try:
            async with asyncio.timeout(self._timeout):
                if tools.has_native:
                    result = await tools.execute("check_requested", {"term": term})
                    ledger.observe("check_requested", {"term": term}, result)
                    observations.append(
                        {"tool": "check_requested", "arguments": {"term": term}, "result": result}
                    )
                    rows = tools.native_facts.get(term, ())
                    if rows:
                        retained = ExplorationOutcome(
                            hotels=tools.hotels,
                            bbox=tools.bbox,
                            intents=(wish_intent(term, tools.native_required.get(term, False)),),
                            facts=rows,
                        )
                        if any(row.value is True for row in rows):
                            status, reason = (
                                WishStatus.MATCHED,
                                "Пожелание подтверждено проверенными данными.",
                            )
                            return completion.finish(status, reason, retained, None)
                else:
                    observations.append(
                        {
                            "tool": "inspect_data",
                            "arguments": {},
                            "result": await tools.execute("inspect_data", {}),
                        }
                    )
                for index in range(self._max_steps):
                    context = wish_context(
                        query,
                        term,
                        tools,
                        ledger,
                        observations,
                        self._max_steps - index,
                        self._clock.now(),
                    )
                    step = await self._llm.explore_data(context)
                    self._logger.info(
                        "wish_agent_step", wish=term, step=index + 1, action=step.action
                    )
                    if step.action == "finish" and ledger.repeated_finish(repr(step)):
                        reason = "Агент повторяет необоснованное завершение; проверка не завершена."
                        break
                    if step.criteria:
                        candidate, rejected = await evaluate_criteria(
                            self._llm, query, term, step.criteria, tools, self._clock.now()
                        )
                        if candidate.intents:
                            retained = candidate
                        if any(row.value is True for row in retained.facts):
                            return completion.finish(
                                WishStatus.MATCHED,
                                "Пожелание подтверждено источниками.",
                                retained,
                                None,
                            )
                        if rejected or (step.criteria and not candidate.intents):
                            observations.append(
                                {
                                    "tool": "validate_criteria",
                                    "result": {
                                        "error": "Checks do not establish this wish; use returned fields and their actual scope.",
                                        "fields": tools.descriptions,
                                    },
                                }
                            )
                            if step.action == "finish":
                                continue
                    if step.action == "finish":
                        if step.question:
                            return completion.finish(
                                WishStatus.NEEDS_INPUT,
                                step.reason
                                or "Для проверки пожелания требуется уточнение пользователя.",
                                retained,
                                step.question,
                            )
                        missing = ledger.missing(step.irrelevant_sources)
                        if (
                            missing
                            or ledger.pending_pages
                            or len(step.reason.strip()) < 12
                            or not ledger.checked
                        ):
                            observations.append(
                                {
                                    "tool": "validate_completion",
                                    "result": {
                                        "error": "No match yet. Check remaining relevant sources or explain why they cannot establish this wish. Unread pages cannot count as exhausted.",
                                        "missing_sources": missing,
                                        "pending_pages": ledger.pending_pages,
                                    },
                                }
                            )
                            continue
                        status = (
                            WishStatus.UNAVAILABLE if ledger.unavailable else WishStatus.EXHAUSTED
                        )
                        return completion.finish(status, step.reason, retained, None)
                    identity = ledger.identity(step.action, step.arguments)
                    if identity in ledger.calls:
                        ledger.duplicates += 1
                        observations.append(
                            {
                                "tool": step.action,
                                "result": {
                                    "error": "Identical call already returned these data. Choose a new query/source or justify completion.",
                                    "previous": ledger.calls[identity],
                                },
                            }
                        )
                        if ledger.duplicates >= 3:
                            reason = "Агент повторял одинаковые действия и не завершил проверку пожелания."
                            break
                        continue
                    try:
                        result = await tools.execute(step.action, step.arguments)
                    except (ValueError, TypeError, KeyError) as error:
                        result = {"error": str(error)}
                    except ModelFailure as error:
                        result = {"unavailable": True, "error": str(error)}
                    ledger.observe(step.action, step.arguments, result)
                    observations.append(
                        {"tool": step.action, "arguments": step.arguments, "result": result}
                    )
                    verified = (
                        [result]
                        if step.action == "match_records"
                        else (result.get("evidence", []) if step.action == "read_web_page" else [])
                    )
                    supported = next(
                        (item for item in verified if item.get("matched_record_count", 0) > 0), None
                    )
                    if supported is not None:
                        criterion = DataCriterion(
                            term=term,
                            source_text=term,
                            checks=(DataCheck(field=str(supported["field"]), op="gte", value=1),),
                            required=tools.native_required.get(term, False),
                            explanation="Смысл пожелания подтверждён цитатой источника.",
                        )
                        candidate = materialize(
                            query, (term,), (criterion,), tools, self._clock.now(), None
                        )
                        if any(row.value is True for row in candidate.facts):
                            retained = replace(
                                candidate,
                                facts=relabel_facts(term, candidate.facts),
                                intents=(wish_intent(term, criterion.required),),
                            )
                            return completion.finish(
                                WishStatus.MATCHED,
                                "Смысл пожелания подтверждён цитатой источника.",
                                retained,
                                None,
                            )
                    if step.criteria:
                        candidate, _ = await evaluate_criteria(
                            self._llm, query, term, step.criteria, tools, self._clock.now()
                        )
                        if candidate.intents:
                            retained = candidate
                        if any(row.value is True for row in retained.facts):
                            return completion.finish(
                                WishStatus.MATCHED,
                                "Проверка пожелания дала подтверждённый результат.",
                                retained,
                                None,
                            )
        except (TimeoutError, ModelFailure) as error:
            status = (
                WishStatus.UNAVAILABLE if isinstance(error, ModelFailure) else WishStatus.INCOMPLETE
            )
            reason = "Проверка пожелания прервана из-за недоступности модели или истечения времени. Отсутствие результата не доказывает отсутствие свойства."
            self._logger.warning("wish_agent_unavailable", wish=term, cause=type(error).__name__)
        return completion.finish(status, reason, retained, question)
