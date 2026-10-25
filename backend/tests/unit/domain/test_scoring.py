from datetime import datetime

import pytest

from hotel_agent.domain.characteristics import Op, ScalarValue
from hotel_agent.domain.entities import FactStatus
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import MatchQuality, match, score
from tests.unit.domain.conftest import FactMaker


def intent(
    key: str = "distance_to_sea",
    op: Op = Op.LTE,
    value: ScalarValue = 10.0,
    *,
    weight: float = 1.0,
    required: bool = False,
) -> Intent:
    return Intent(
        characteristic_key=key,
        op=op,
        value=value,
        weight=weight,
        required=required,
        source_text="недалеко от моря",
    )


@pytest.mark.parametrize(
    ("op", "wanted", "value", "expected"),
    [
        (Op.LTE, 10.0, 6.0, MatchQuality.FULL),
        (Op.LTE, 10.0, 10.0, MatchQuality.FULL),
        (Op.LTE, 10.0, 14.0, MatchQuality.PARTIAL),
        (Op.LTE, 10.0, 20.0, MatchQuality.NONE),
        (Op.GTE, 3.0, 5.0, MatchQuality.FULL),
        (Op.GTE, 3.0, 2.5, MatchQuality.PARTIAL),
        (Op.GTE, 3.0, 1.0, MatchQuality.NONE),
        (Op.EXISTS, None, 6.0, MatchQuality.FULL),
    ],
)
def test_numeric_operators_grade_the_fact(
    make_fact: FactMaker,
    now: datetime,
    op: Op,
    wanted: ScalarValue,
    value: float,
    expected: MatchQuality,
) -> None:
    graded = match(intent(op=op, value=wanted), make_fact(value=value), now)

    assert graded.quality is expected


def test_a_boolean_fact_matches_on_equality(make_fact: FactMaker, now: datetime) -> None:
    wanted = intent("sunset_view", Op.EQ, True)

    assert match(wanted, make_fact(value=True), now).quality is MatchQuality.FULL
    assert match(wanted, make_fact(value=False), now).quality is MatchQuality.NONE


def test_a_qualified_fact_is_only_a_partial_match(make_fact: FactMaker, now: datetime) -> None:
    restricted = make_fact(value=True, qualifiers={"from_floor": 5.0})

    graded = match(intent("sunset_view", Op.EQ, True), restricted, now)

    assert graded.quality is MatchQuality.PARTIAL


def test_route_metadata_does_not_restrict_match(make_fact: FactMaker, now: datetime) -> None:
    route = make_fact(value=6.0, qualifiers={"meters": 480.0})

    graded = match(intent("distance_to_sea", Op.LTE, 10.0), route, now)

    assert graded.quality is MatchQuality.FULL


def test_a_missing_fact_is_unknown_rather_than_a_mismatch(now: datetime) -> None:
    assert match(intent(), None, now).quality is MatchQuality.UNKNOWN


def test_a_fact_being_computed_is_reported_as_such(make_fact: FactMaker, now: datetime) -> None:
    pending = make_fact(value=None, status=FactStatus.COMPUTING)

    assert match(intent(), pending, now).quality is MatchQuality.COMPUTING


def test_score_weighs_quality_by_confidence(make_fact: FactMaker, now: datetime) -> None:
    facts = {"distance_to_sea": make_fact(value=6.0, confidence=0.8, ttl_days=None)}

    result = score([intent()], facts, now)

    assert result.score == pytest.approx(0.8)
    assert not result.disqualified


def test_score_is_the_weighted_share_of_what_matched(make_fact: FactMaker, now: datetime) -> None:
    facts = {
        "distance_to_sea": make_fact("f_1", 6.0, confidence=1.0, ttl_days=None),
        "sunset_view": make_fact(
            "f_2", True, confidence=1.0, ttl_days=None, characteristic_key="sunset_view"
        ),
    }
    wanted = [intent(weight=3.0), intent("sunset_view", Op.EQ, True, weight=1.0)]

    assert score(wanted, facts, now).score == pytest.approx(1.0)


def test_an_unknown_property_lowers_the_score_without_removing_the_hotel(
    make_fact: FactMaker, now: datetime
) -> None:
    facts = {"distance_to_sea": make_fact(value=6.0, confidence=1.0, ttl_days=None)}
    wanted = [intent(weight=1.0), intent("sunset_view", Op.EQ, True, weight=1.0)]

    result = score(wanted, facts, now)

    assert result.score == pytest.approx(0.5)
    assert not result.disqualified
    assert [item.quality for item in result.matches] == [MatchQuality.FULL, MatchQuality.UNKNOWN]


def test_a_required_property_that_is_missing_disqualifies_the_hotel(
    make_fact: FactMaker, now: datetime
) -> None:
    facts = {"distance_to_sea": make_fact(value=6.0, confidence=1.0, ttl_days=None)}
    wanted = [intent(), intent("pets_policy", Op.EQ, True, required=True)]

    result = score(wanted, facts, now)

    assert result.disqualified
    assert result.score == 0.0


def test_a_required_property_that_is_only_partial_still_counts(
    make_fact: FactMaker, now: datetime
) -> None:
    restricted = make_fact(
        value=True, confidence=1.0, ttl_days=None, qualifiers={"from_floor": 5.0}
    )
    wanted = [intent("sunset_view", Op.EQ, True, required=True)]

    result = score(wanted, {"sunset_view": restricted}, now)

    assert not result.disqualified
    assert result.score == pytest.approx(0.5)


def test_a_stale_fact_scores_lower_than_a_fresh_one(make_fact: FactMaker, now: datetime) -> None:
    fresh = score([intent()], {"distance_to_sea": make_fact(value=6.0, confidence=0.8)}, now)
    aged = score(
        [intent()],
        {"distance_to_sea": make_fact(value=6.0, confidence=0.8, age_days=400.0)},
        now,
    )

    assert aged.score < fresh.score
