from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from hotel_agent.domain.entities import QuestionReason

REASON_URGENCY = {
    QuestionReason.CONFLICT: 3.0,
    QuestionReason.STALE: 2.0,
    QuestionReason.LOW_CONFIDENCE: 1.5,
    QuestionReason.MISSING: 1.0,
}
BLOCKED_SEARCH_WEIGHT = 0.5
AGE_WEIGHT = 0.05
MAX_COUNTED_AGE_DAYS = 30.0


def question_priority(
    *,
    reason: QuestionReason,
    blocked_searches: int,
    characteristic_weight: float,
    opened_at: datetime,
    now: datetime,
) -> float:
    age_days = min(max((now - opened_at).total_seconds() / 86400.0, 0.0), MAX_COUNTED_AGE_DAYS)
    return (
        REASON_URGENCY[reason]
        + BLOCKED_SEARCH_WEIGHT * max(blocked_searches, 0)
        + max(characteristic_weight, 0.0)
        + AGE_WEIGHT * age_days
    )


def worth_asking(*, reason: QuestionReason, blocked_searches: int) -> bool:
    if reason is not QuestionReason.MISSING:
        return True
    return blocked_searches > 0


class ActionKind(StrEnum):
    RESOLVE_CONFLICT = "resolve_conflict"
    ANSWER_QUESTION = "answer_question"
    RECONFIRM_VALUE = "reconfirm_value"


CONCERN_ORDER = (
    ActionKind.RESOLVE_CONFLICT,
    ActionKind.ANSWER_QUESTION,
    ActionKind.RECONFIRM_VALUE,
)


@dataclass(frozen=True, slots=True, kw_only=True)
class Attention:
    kind: ActionKind
    reference: str
    characteristic_key: str
    blocked_searches: int = 0


def first_attention(items: Sequence[Attention]) -> Attention | None:
    ranked = sorted(
        items,
        key=lambda item: (
            CONCERN_ORDER.index(item.kind),
            -item.blocked_searches,
            item.characteristic_key,
            item.reference,
        ),
    )
    return next(iter(ranked), None)
