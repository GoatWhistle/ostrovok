import asyncio
from typing import Any

from hotel_agent.application.agent.data_records import DataStep, ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_context import wish_context
from hotel_agent.application.agent.wish_criteria import evaluate_criteria
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.agent.wish_notices import (
    budget_notice,
    criteria_notice,
    duplicate_notice,
    stall_notice,
    time_notice,
)
from hotel_agent.application.agent.wish_opening import open_wish
from hotel_agent.application.agent.wish_outcomes import WishCompletion
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.agent.wish_settlement import Settled, quoted_outcome, settle
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure

STALL_NOTICE = 6
STALL_LIMIT = 10
UNFINISHED = "Поиск пожелания не завершён; это не означает отсутствие подходящих отелей."


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
        status, reason, question = WishStatus.INCOMPLETE, UNFINISHED, None
        try:
            async with asyncio.timeout(self._timeout):
                opening = await open_wish(term, tools, ledger, self._logger)
                observations.extend(opening.observations)
                retained = opening.retained or retained
                if opening.matched:
                    return completion.finish(
                        WishStatus.MATCHED,
                        "Пожелание подтверждено проверенными данными.",
                        retained,
                        None,
                    )
                outcome, reason = await self._walk(
                    query, term, tools, ledger, completion, observations, retained, started, warned
                )
                if outcome is not None:
                    return outcome
        except (TimeoutError, ModelFailure) as error:
            status = (
                WishStatus.UNAVAILABLE if isinstance(error, ModelFailure) else WishStatus.INCOMPLETE
            )
            reason = "Проверка пожелания прервана из-за недоступности модели или истечения времени. Отсутствие результата не доказывает отсутствие свойства."
            self._logger.warning("wish_agent_unavailable", wish=term, cause=type(error).__name__)
        return completion.finish(status, reason, retained, question)

    async def _plan(
        self, context: str, term: str, index: int, tools: DataTools, note: bool
    ) -> DataStep:
        planned_at = asyncio.get_running_loop().time()
        step = (
            DataStep(action="match_records", arguments={"dataset": "web_documents"})
            if index == 0 and tools.research.pages and not note
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
        return step

    async def _check(
        self, query: str, term: str, step: DataStep, tools: DataTools
    ) -> tuple[ExplorationOutcome, tuple[str, ...]]:
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
        return candidate, rejected

    async def _walk(
        self,
        query: str,
        term: str,
        tools: DataTools,
        ledger: WishLedger,
        completion: WishCompletion,
        observations: list[dict[str, Any]],
        retained: ExplorationOutcome,
        started: float,
        warned: set[int],
    ) -> tuple[ExplorationOutcome | None, str]:
        reason = UNFINISHED
        note = bool(observations)
        barren = 0
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
            step = await self._plan(context, term, index, tools, note)
            if step.action == "finish" and ledger.repeated_finish(repr(step)):
                return None, "Агент повторяет необоснованное завершение; проверка не завершена."
            if step.criteria:
                candidate, rejected = await self._check(query, term, step, tools)
                if candidate.intents:
                    retained, barren = candidate, 0
                if any(row.value is True for row in retained.facts):
                    return completion.finish(
                        WishStatus.MATCHED, "Пожелание подтверждено источниками.", retained, None
                    ), reason
                if rejected or not candidate.intents:
                    observations.append(criteria_notice(tools.descriptions))
                    if step.action == "finish":
                        self._logger.info(
                            "wish_finish_rejected",
                            wish=term,
                            cause="criteria",
                            rejected=" ".join(rejected),
                            intents=len(candidate.intents),
                        )
                        continue
            if step.action == "finish":
                if step.question:
                    return completion.finish(
                        WishStatus.NEEDS_INPUT,
                        step.reason or "Для проверки пожелания требуется уточнение пользователя.",
                        retained,
                        step.question,
                    ), reason
                outcome = settle(step, ledger, 85 in warned, reason, self._logger, term)
                if isinstance(outcome, Settled):
                    return completion.finish(
                        outcome.status, outcome.reason, retained, None
                    ), outcome.reason
                observations.append(outcome)
                continue
            if ledger.exhausted(step.action):
                observations.append(budget_notice(step.action, ledger.used[step.action]))
                continue
            identity = ledger.identity(step.action, step.arguments)
            if identity in ledger.calls:
                ledger.duplicates += 1
                observations.append(duplicate_notice(step.action, ledger.calls[identity]))
                if ledger.duplicates >= 3:
                    return (
                        None,
                        "Агент повторял одинаковые действия и не завершил проверку пожелания.",
                    )
                continue
            result = await self._execute(step, term, tools, ledger, observations)
            barren += 1
            quoted = quoted_outcome(query, term, step, result, tools, self._clock.now())
            if quoted is not None:
                return completion.finish(
                    WishStatus.MATCHED,
                    "Смысл пожелания подтверждён цитатой источника.",
                    quoted,
                    None,
                ), reason
            if step.criteria:
                candidate, _ = await self._check(query, term, step, tools)
                if candidate.intents:
                    retained, barren = candidate, 0
                if any(row.value is True for row in retained.facts):
                    return completion.finish(
                        WishStatus.MATCHED,
                        "Проверка пожелания дала подтверждённый результат.",
                        retained,
                        None,
                    ), reason
            if barren >= STALL_LIMIT:
                self._logger.info("wish_agent_stalled", wish=term, steps=barren, used=index + 1)
                return None, (
                    "Источники не дали ничего нового по этому пожеланию; проверка остановлена,"
                    " это не доказывает отсутствие свойства."
                )
            if barren == STALL_NOTICE:
                observations.append(stall_notice(barren))
        return None, reason

    async def _execute(
        self,
        step: DataStep,
        term: str,
        tools: DataTools,
        ledger: WishLedger,
        observations: list[dict[str, Any]],
    ) -> dict[str, Any]:
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
        observations.append({"tool": step.action, "arguments": step.arguments, "result": result})
        return result
