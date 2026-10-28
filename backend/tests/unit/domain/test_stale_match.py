from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from hotel_agent.domain.characteristics import Op, SourceType
from hotel_agent.domain.entities import Fact, FactStatus
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import MatchQuality, match, score
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


def measured(value: float, threshold: float, op: Op) -> Fact:
    row = fact(timedelta(days=1))
    return replace(
        row,
        characteristic_key="distance_to_sea",
        value=value,
        qualifiers={"native_value": value, "native_threshold": threshold, "native_op": str(op)},
    )


def ordered(op: Op, threshold: float) -> Intent:
    return Intent(
        characteristic_key="distance_to_sea",
        op=op,
        value=threshold,
        weight=1.0,
        required=False,
        source_text="до моря",
    )


def test_a_wider_margin_scores_above_a_tight_one_within_the_same_tier() -> None:
    close = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(2.0, 10.0, Op.LTE)}, NOW)
    tight = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(9.5, 10.0, Op.LTE)}, NOW)

    assert close.score > tight.score
    assert close.matches[0].quality is tight.matches[0].quality


def test_the_margin_never_lifts_a_partial_above_a_full_match() -> None:
    full = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(9.9, 10.0, Op.LTE)}, NOW)
    generous = replace(measured(2.0, 10.0, Op.LTE), qualifiers={"months": "апрель"})
    partial = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": generous}, NOW)

    assert partial.matches[0].quality is MatchQuality.PARTIAL
    assert full.score > partial.score


def test_a_measured_condition_is_never_worth_less_than_an_unmeasured_one() -> None:
    plain = replace(measured(10.0, 10.0, Op.LTE), qualifiers={})
    bare = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": plain}, NOW)
    exact = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(10.0, 10.0, Op.LTE)}, NOW)
    roomy = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(4.0, 10.0, Op.LTE)}, NOW)

    assert exact.score == pytest.approx(bare.score)
    assert roomy.score > bare.score


def test_the_best_partial_never_overtakes_the_tightest_full() -> None:
    tight = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": measured(10.0, 10.0, Op.LTE)}, NOW)
    generous = replace(measured(4.0, 10.0, Op.LTE), qualifiers={"months": "апрель"})
    best_partial = score([ordered(Op.LTE, 10.0)], {"distance_to_sea": generous}, NOW)

    assert best_partial.matches[0].quality is MatchQuality.PARTIAL
    assert tight.score > best_partial.score
