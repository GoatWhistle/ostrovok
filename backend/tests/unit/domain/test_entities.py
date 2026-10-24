from datetime import UTC, datetime

import pytest

from hotel_agent.domain.entities import (
    Conflict,
    FactStatus,
    HotelierQuestion,
    QuestionReason,
    QuestionStatus,
    Resolution,
    facts_by_characteristic,
)
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import ConflictId, FactId, HotelId, QuestionId, Subject
from tests.unit.domain.conftest import FactMaker

NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def test_an_expired_fact_becomes_stale(make_fact: FactMaker, now: datetime) -> None:
    aged = make_fact(age_days=400.0)

    assert aged.is_stale_at(now)
    assert aged.at(now).status is FactStatus.STALE


def test_a_fact_inside_its_ttl_is_left_alone(make_fact: FactMaker, now: datetime) -> None:
    fresh = make_fact(age_days=10.0)

    assert not fresh.is_stale_at(now)
    assert fresh.at(now) is fresh


def test_a_superseded_fact_is_not_relabelled_stale(make_fact: FactMaker, now: datetime) -> None:
    settled = make_fact(age_days=400.0, status=FactStatus.SUPERSEDED)

    assert settled.at(now).status is FactStatus.SUPERSEDED


def test_a_fact_cannot_supersede_itself(make_fact: FactMaker) -> None:
    fact = make_fact("f_1")

    with pytest.raises(InvalidValue, match="supersede itself"):
        fact.superseded_by(fact)


def test_a_computing_fact_carries_no_value(make_fact: FactMaker) -> None:
    with pytest.raises(InvalidValue, match="computing fact"):
        make_fact(value=6.0, status=FactStatus.COMPUTING)


def test_facts_group_by_characteristic(make_fact: FactMaker) -> None:
    grouped = facts_by_characteristic(
        [
            make_fact("f_1", characteristic_key="distance_to_sea"),
            make_fact("f_2", True, characteristic_key="sunset_view"),
            make_fact("f_3", characteristic_key="distance_to_sea"),
        ]
    )

    assert {key: [fact.id for fact in facts] for key, facts in grouped.items()} == {
        "distance_to_sea": ["f_1", "f_3"],
        "sunset_view": ["f_2"],
    }


def test_a_conflict_needs_two_facts() -> None:
    with pytest.raises(InvalidValue, match="at least two facts"):
        Conflict(
            id=ConflictId("c_1"),
            characteristic_key="pets_policy",
            subject=Subject.hotel(HotelId("h_1")),
            fact_ids=(FactId("f_1"),),
            resolution=Resolution.PENDING,
            rule="rule",
        )


@pytest.mark.parametrize(
    ("resolution", "winner", "message"),
    [
        (Resolution.PENDING, FactId("f_1"), "pending conflict has no winner"),
        (Resolution.RESOLVED_BY_RULE, None, "resolved conflict names its winner"),
    ],
)
def test_conflict_resolution_and_winner_agree(
    resolution: Resolution, winner: FactId | None, message: str
) -> None:
    with pytest.raises(InvalidValue, match=message):
        Conflict(
            id=ConflictId("c_1"),
            characteristic_key="pets_policy",
            subject=Subject.hotel(HotelId("h_1")),
            fact_ids=(FactId("f_1"), FactId("f_2")),
            resolution=resolution,
            rule="rule",
            winner_fact_id=winner,
        )


def question() -> HotelierQuestion:
    return HotelierQuestion(
        id=QuestionId("q_1"),
        hotel_id=HotelId("h_1"),
        characteristic_key="pets_policy",
        text="Можно ли с питомцами?",
        reason=QuestionReason.MISSING,
        created_at=NOW,
    )


def test_an_open_question_can_be_answered_or_skipped() -> None:
    assert question().answered().status is QuestionStatus.ANSWERED
    assert question().skipped().status is QuestionStatus.SKIPPED


def test_a_settled_question_is_not_answered_twice() -> None:
    with pytest.raises(InvalidValue, match="already answered"):
        question().answered().answered()
