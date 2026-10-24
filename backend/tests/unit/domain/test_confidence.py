from datetime import UTC, datetime, timedelta

import pytest

from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.services.confidence import aggregate, effective
from hotel_agent.domain.value_objects import Confidence, Provenance, SourceRef

NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def provenance(*, age_days: float, ttl_days: float | None) -> Provenance:
    computed_at = NOW - timedelta(days=age_days)
    return Provenance(
        source=SourceRef(source_type=SourceType.COMPUTED),
        method="distance_to_sea@1",
        confidence=Confidence(0.8),
        computed_at=computed_at,
        valid_until=computed_at + timedelta(days=ttl_days) if ttl_days is not None else None,
    )


def test_a_fact_without_an_expiry_does_not_decay() -> None:
    assert effective(provenance(age_days=4000, ttl_days=None), NOW) == Confidence(0.8)


@pytest.mark.parametrize(
    ("age_days", "expected"),
    [(0.0, 0.8), (50.0, 0.7), (100.0, 0.6), (400.0, 0.4)],
)
def test_confidence_decays_towards_half_at_expiry(age_days: float, expected: float) -> None:
    decayed = effective(provenance(age_days=age_days, ttl_days=200.0), NOW)

    assert decayed.value == pytest.approx(expected)


def test_decay_stops_at_expiry_instead_of_reaching_zero() -> None:
    just_expired = effective(provenance(age_days=200.0, ttl_days=200.0), NOW)
    long_expired = effective(provenance(age_days=5000.0, ttl_days=200.0), NOW)

    assert just_expired == long_expired == Confidence(0.4)


def test_agreeing_observations_reinforce_each_other() -> None:
    assert aggregate([Confidence(0.5), Confidence(0.5)]).value == pytest.approx(0.75)
    assert aggregate([Confidence(0.9)]) == Confidence(0.9)


def test_aggregating_nothing_is_no_belief() -> None:
    assert aggregate([]) == Confidence(0.0)


def test_a_certain_observation_stays_certain() -> None:
    assert aggregate([Confidence(1.0), Confidence(0.1)]) == Confidence(1.0)
