from datetime import UTC, datetime, timedelta

from hotel_agent.domain.entities import QuestionReason
from hotel_agent.domain.services.hotelier_attention import question_priority, worth_asking

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)


def priority(
    reason: QuestionReason = QuestionReason.MISSING,
    blocked: int = 0,
    weight: float = 1.0,
    age_days: float = 0.0,
) -> float:
    return question_priority(
        reason=reason,
        blocked_searches=blocked,
        characteristic_weight=weight,
        opened_at=NOW - timedelta(days=age_days),
        now=NOW,
    )


def test_a_question_that_blocked_real_searches_outranks_an_idle_one() -> None:
    assert priority(blocked=6) > priority(blocked=0)


def test_a_contested_value_outranks_a_missing_one() -> None:
    assert priority(reason=QuestionReason.CONFLICT) > priority(reason=QuestionReason.STALE)
    assert priority(reason=QuestionReason.STALE) > priority(reason=QuestionReason.MISSING)


def test_an_old_question_climbs_but_never_overtakes_real_demand() -> None:
    assert priority(age_days=20.0) > priority(age_days=1.0)
    assert priority(age_days=400.0) < priority(blocked=10)


def test_negative_inputs_do_not_subtract_from_the_score() -> None:
    assert priority(blocked=-5, weight=-2.0, age_days=-10.0) == priority(weight=0.0)


def test_only_a_missing_value_has_to_earn_its_question() -> None:
    assert not worth_asking(reason=QuestionReason.MISSING, blocked_searches=0)
    assert worth_asking(reason=QuestionReason.MISSING, blocked_searches=1)
    assert worth_asking(reason=QuestionReason.CONFLICT, blocked_searches=0)
    assert worth_asking(reason=QuestionReason.STALE, blocked_searches=0)
    assert worth_asking(reason=QuestionReason.LOW_CONFIDENCE, blocked_searches=0)
