from dataclasses import replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_evidence import unresolved_facts, wish_intent
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.agent.wish_records import WishResult, WishStatus
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.log import LoggerPort


class WishCompletion:
    def __init__(
        self, clock: ClockPort, logger: LoggerPort, term: str, ledger: WishLedger, tools: DataTools
    ) -> None:
        self._clock, self._logger, self._term = clock, logger, term
        self._ledger, self._tools = ledger, tools

    def finish(
        self, status: WishStatus, reason: str, retained: ExplorationOutcome, question: str | None
    ) -> ExplorationOutcome:
        clock, logger, term, ledger, tools = (
            self._clock,
            self._logger,
            self._term,
            self._ledger,
            self._tools,
        )
        result = WishResult(
            term,
            status,
            reason,
            len(ledger.calls),
            tuple(sorted(ledger.checked)),
            tuple(dict.fromkeys(row.hotel_id for row in retained.facts if row.value is True)),
        )
        existing = {row.hotel_id: row for row in retained.facts}
        missing = unresolved_facts(result, tools.hotels, clock.now())
        facts = tuple(existing.get(row.hotel_id, row) for row in missing)
        facts = tuple(
            replace(
                row,
                qualifiers={
                    **row.qualifiers,
                    "wish_status": status,
                    "checked_sources": list(result.checked_sources),
                    "tool_calls": result.tool_calls,
                },
            )
            for row in facts
        )
        logger.info(
            "wish_agent_finished", wish=term, status=str(status), tool_calls=result.tool_calls
        )
        return ExplorationOutcome(
            hotels=tools.hotels,
            bbox=tools.bbox,
            intents=retained.intents
            or (wish_intent(term, tools.native_required.get(term, False)),),
            facts=facts,
            resolved_terms=(term,) if status is WishStatus.MATCHED else (),
            question=question,
            features=tuple(tools.native_features),
            wish_results=(result,),
            processed_terms=(term,),
        )
