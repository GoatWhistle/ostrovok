from datetime import UTC, datetime, timedelta

from hotel_agent.domain.characteristics import Op, SourceType
from hotel_agent.domain.entities import Fact, FactStatus
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import MatchQuality, match
from hotel_agent.domain.value_objects import (
    Confidence,
    FactId,
    Provenance,
    SourceRef,
    Subject,
    SubjectKind,
)

NOW = datetime(2026, 10, 28, tzinfo=UTC)


def fact(valid_for: timedelta) -> Fact:
    return Fact(
        id=FactId("f1"),
        subject=Subject(kind=SubjectKind.HOTEL, owner="h1"),
        characteristic_key="noise_level",
        value=True,
        unit=None,
        qualifiers={},
        provenance=Provenance(
            source=SourceRef(source_type=SourceType.COMPUTED, ref="noise"),
            method="noise_level@1",
            confidence=Confidence(0.9),
            computed_at=NOW - timedelta(days=30),
            valid_until=NOW + valid_for,
        ),
        status=FactStatus.ACTIVE,
        explanation="",
    )


def wanted() -> Intent:
    return Intent(
        characteristic_key="noise_level",
        op=Op.EQ,
        value=True,
        weight=1.0,
        required=False,
        source_text="тихо",
    )


def test_a_fresh_fact_still_matches_fully() -> None:
    assert match(wanted(), fact(timedelta(days=1)), NOW).quality is MatchQuality.FULL


def test_an_expired_fact_cannot_be_a_full_match() -> None:
    assert match(wanted(), fact(timedelta(days=-1)), NOW).quality is MatchQuality.PARTIAL
