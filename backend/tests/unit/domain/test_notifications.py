from datetime import UTC, datetime, timedelta

import pytest

from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.notifications import (
    Notification,
    NotificationKind,
    Severity,
    change_severity,
    notification,
)
from hotel_agent.domain.value_objects import FactId, HotelId, QuestionId

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)
HOTEL = HotelId("h_1")


def test_a_question_notification_asks_the_hotelier_to_act() -> None:
    item = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.QUESTION_OPENED,
        created_at=NOW,
        characteristic_key="pets_policy",
        question_id=QuestionId("q_1"),
    )

    assert item.severity is Severity.ACTION
    assert item.needs_action
    assert item.references == ("q_1",)


def test_an_accepted_answer_only_informs() -> None:
    item = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.ANSWER_ACCEPTED,
        created_at=NOW,
        question_id=QuestionId("q_1"),
        fact_id=FactId("f_1"),
    )

    assert item.severity is Severity.INFO
    assert not item.needs_action
    assert item.references == ("q_1", "f_1")


def test_the_same_event_keeps_one_identity() -> None:
    first = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.FACT_EXPIRING,
        created_at=NOW,
        fact_id=FactId("f_1"),
    )
    again = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.FACT_EXPIRING,
        created_at=NOW + timedelta(days=2),
        fact_id=FactId("f_1"),
    )

    assert first.dedup_key == again.dedup_key
    assert first.id == again.id


def test_a_daily_bucket_lets_demand_repeat_tomorrow() -> None:
    today = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.SEARCH_DEMAND,
        created_at=NOW,
        characteristic_key="pets_policy",
        bucket="2026-10-28",
    )
    tomorrow = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.SEARCH_DEMAND,
        created_at=NOW + timedelta(days=1),
        characteristic_key="pets_policy",
        bucket="2026-10-29",
    )

    assert today.dedup_key != tomorrow.dedup_key
    assert today.id != tomorrow.id


def test_demand_needs_no_reference_but_a_question_does() -> None:
    assert (
        notification(
            hotel_id=HOTEL,
            kind=NotificationKind.SEARCH_DEMAND,
            created_at=NOW,
            characteristic_key="noise_level",
            bucket="2026-10-28",
        ).references
        == ()
    )

    with pytest.raises(InvalidValue):
        notification(hotel_id=HOTEL, kind=NotificationKind.QUESTION_OPENED, created_at=NOW)


def test_reading_is_recorded_once() -> None:
    item = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.CONFLICT_OPENED,
        created_at=NOW,
        fact_id=FactId("f_1"),
    )

    read = item.read(NOW + timedelta(minutes=5))
    again = read.read(NOW + timedelta(hours=9))

    assert item.is_unread
    assert read.read_at == NOW + timedelta(minutes=5)
    assert again is read


def test_a_notification_is_never_read_before_it_appears() -> None:
    item = notification(
        hotel_id=HOTEL,
        kind=NotificationKind.FACT_CHANGED,
        created_at=NOW,
        fact_id=FactId("f_1"),
    )

    assert item.read(NOW - timedelta(hours=1)).read_at == NOW
    with pytest.raises(InvalidValue):
        Notification(
            id=item.id,
            hotel_id=HOTEL,
            kind=item.kind,
            severity=item.severity,
            created_at=NOW,
            dedup_key=item.dedup_key,
            fact_id=FactId("f_1"),
            read_at=NOW - timedelta(hours=1),
        )


def test_a_recomputed_value_calls_for_action_only_against_a_hotelier_statement() -> None:
    assert change_severity(was_confirmed_by_hotelier=True) is Severity.ACTION
    assert change_severity(was_confirmed_by_hotelier=False) is Severity.INFO
