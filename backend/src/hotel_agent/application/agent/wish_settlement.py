from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import (
    DataCheck,
    DataCriterion,
    DataStep,
    ExplorationOutcome,
)
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_evidence import relabel_facts, wish_intent
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.agent.wish_notices import SOURCES_LEFT
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.log import LoggerPort

MIN_REASON = 12
QUOTED = "Смысл пожелания подтверждён цитатой источника."


@dataclass(frozen=True, slots=True)
class Settled:
    status: WishStatus
    reason: str


def settle(
    step: DataStep,
    ledger: WishLedger,
    out_of_time: bool,
    fallback: str,
    logger: LoggerPort,
    term: str,
) -> Settled | dict[str, Any]:
    missing = ledger.missing(step.irrelevant_sources)
    if not out_of_time and (
        missing
        or ledger.pending_pages
        or len(step.reason.strip()) < MIN_REASON
        or not ledger.checked
    ):
        logger.info(
            "wish_finish_rejected",
            wish=term,
            cause="sources",
            missing=" ".join(missing),
            pending_pages=len(ledger.pending_pages),
            reason_length=len(step.reason.strip()),
        )
        return {
            "tool": "validate_completion",
            "result": {
                "error": SOURCES_LEFT,
                "missing_sources": missing,
                "pending_pages": ledger.pending_pages,
            },
        }
    status = (
        WishStatus.UNAVAILABLE
        if ledger.unavailable
        else WishStatus.INCOMPLETE
        if missing or ledger.pending_pages
        else WishStatus.EXHAUSTED
    )
    return Settled(status, step.reason if len(step.reason.strip()) >= MIN_REASON else fallback)


def quoted_outcome(
    query: str,
    term: str,
    step: DataStep,
    result: dict[str, Any],
    tools: DataTools,
    now: datetime,
) -> ExplorationOutcome | None:
    verified = (
        [result]
        if step.action == "match_records"
        else (result.get("evidence", []) if step.action == "read_web_page" else [])
    )
    supported = next((item for item in verified if item.get("matched_record_count", 0) > 0), None)
    if supported is None:
        return None
    criterion = DataCriterion(
        term=term,
        source_text=term,
        checks=(DataCheck(field=str(supported["field"]), op="gte", value=1),),
        required=tools.native_required.get(term, False),
        explanation=QUOTED,
    )
    candidate = materialize(query, (term,), (criterion,), tools, now, None)
    if not any(row.value is True for row in candidate.facts):
        return None
    return replace(
        candidate,
        facts=relabel_facts(term, candidate.facts),
        intents=(wish_intent(term, criterion.required),),
    )
