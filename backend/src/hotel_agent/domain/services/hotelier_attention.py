from datetime import datetime

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
