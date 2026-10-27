import asyncio
from dataclasses import replace
from typing import Any

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import (
    DataCheck,
    DataCriterion,
    DataStep,
    ExplorationOutcome,
)
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.proximity_terms import named_place
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

PRESSED = (
    "Most of the time for this wish is used. Stop widening the search: either confirm the wish"
    " with the data you already have or finish honestly with what is established."
)
LAST_CALL = (
    "The time for this wish is almost over. Finish now: name what the sources did and did not"
    " establish. An unfinished check is not evidence that no hotel matches."
)
NOTICES = ((60, PRESSED), (85, LAST_CALL))


def time_notice(spent: float, left: float, warned: set[int]) -> dict[str, Any] | None:
    for share, message in NOTICES:
        if spent * 100 >= share and share not in warned:
            warned.add(share)
            return {
                "tool": "time_budget",
                "result": {"error": message, "remaining_seconds": round(left, 1)},
            }
    return None


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

    async def run(
        self,
        query: str,
        term: str,
        tools: DataTools,
        note: dict[str, Any] | None = None,
    ) -> ExplorationOutcome:
        started = asyncio.get_running_loop().time()
        warned: set[int] = set()
        ledger = WishLedger(tools.sources)
        completion = WishCompletion(self._clock, self._logger, term, ledger, tools)
        observations: list[dict[str, Any]] = [note] if note else []
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
                place = named_place(term)
                if place:
                    arguments = {"name": place, "radius_m": 20000}
                    try:
                        result = await tools.execute("find_nearby", arguments)
                    except (ValueError, TypeError, KeyError) as error:
                        result = {"error": str(error)}
                    ledger.observe("find_nearby", arguments, result)
                    observations.append(
                        {"tool": "find_nearby", "arguments": arguments, "result": result}
                    )
                    self._logger.info(
                        "wish_place_probe",
                        wish=term,
                        place=place,
                        matched=result.get("hotels_with_match", 0),
                        nearest=(result.get("matches") or [{}])[0].get("nearest_m"),
                    )
                for index in range(self._max_steps):
                    spent = (asyncio.get_running_loop().time() - started) / self._timeout
                    notice = time_notice(spent, self._timeout * (1 - spent), warned)
                    if notice is not None:
                        observations.append(notice)
                    context = wish_context(
                        query,
                        term,
                        tools,
                        ledger,
                        observations,
                        self._max_steps - index,
                        self._clock.now(),
                    )
                    planned_at = asyncio.get_running_loop().time()
                    step = (
                        DataStep(action="match_records", arguments={"dataset": "web_documents"})
                        if index == 0 and tools.research.pages and note is None
                        else await self._llm.explore_data(context)
                    )
                    self._logger.info(
                        "wish_agent_step",
                        wish=term,
                        step=index + 1,
                        action=step.action,
                        seconds=round(asyncio.get_running_loop().time() - planned_at, 1),
                        context_chars=len(context),
                    )
                    if step.action == "finish" and ledger.repeated_finish(repr(step)):
                        reason = "Агент повторяет необоснованное завершение; проверка не завершена."
                        break
                    if step.criteria:
                        checked_at = asyncio.get_running_loop().time()
                        candidate, rejected = await evaluate_criteria(
                            self._llm, query, term, step.criteria, tools, self._clock.now()
                        )
                        self._logger.info(
                            "wish_criteria_checked",
                            wish=term,
                            seconds=round(asyncio.get_running_loop().time() - checked_at, 1),
                            accepted=len(candidate.intents),
                            rejected=len(rejected),
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
                                self._logger.info(
                                    "wish_finish_rejected",
                                    wish=term,
                                    cause="criteria",
                                    rejected=" ".join(rejected),
                                    fields=" ".join(
                                        sorted(
                                            {
                                                check.field
                                                for item in step.criteria
                                                for check in item.checks
                                            }
                                        )
                                    ),
                                    intents=len(candidate.intents),
                                )
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
                        out_of_time = 85 in warned
                        if not out_of_time and (
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
                            self._logger.info(
                                "wish_finish_rejected",
                                wish=term,
                                cause="sources",
                                missing=" ".join(missing),
                                pending_pages=len(ledger.pending_pages),
                                reason_length=len(step.reason.strip()),
                            )
                            continue
                        status = (
                            WishStatus.UNAVAILABLE
                            if ledger.unavailable
                            else WishStatus.INCOMPLETE
                            if missing or ledger.pending_pages
                            else WishStatus.EXHAUSTED
                        )
                        reason = step.reason if len(step.reason.strip()) >= 12 else reason
                        return completion.finish(status, reason, retained, None)
                    if ledger.exhausted(step.action):
                        observations.append(
                            {
                                "tool": step.action,
                                "result": {
                                    "error": f"Budget for {step.action} in this wish is used up."
                                    " Use a different source or finish with what is established.",
                                    "used": ledger.used[step.action],
                                },
                            }
                        )
                        continue
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
                    ran_at = asyncio.get_running_loop().time()
                    try:
                        result = await tools.execute(step.action, step.arguments)
                    except (ValueError, TypeError, KeyError) as error:
                        result = {"error": str(error)}
                    except ModelFailure as error:
                        result = {"unavailable": True, "error": str(error)}
                    self._logger.info(
                        "wish_tool_done",
                        wish=term,
                        action=step.action,
                        seconds=round(asyncio.get_running_loop().time() - ran_at, 1),
                    )
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
