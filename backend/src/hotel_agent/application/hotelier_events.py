from collections.abc import Sequence
from datetime import datetime

from hotel_agent.application.dto import ConflictRecord, SearchFactRecord
from hotel_agent.application.notification_records import notification_to_record
from hotel_agent.application.ports.notifications import NotificationStore
from hotel_agent.domain.entities import Fact, FactStatus, HotelierQuestion
from hotel_agent.domain.notifications import (
    Notification,
    NotificationKind,
    NotificationValue,
    Severity,
    change_severity,
    notification,
)
from hotel_agent.domain.value_objects import ConflictId, FactId, HotelId

PENDING = "pending"


async def announce(store: NotificationStore, items: Sequence[Notification]) -> int:
    if not items:
        return 0
    return await store.add([notification_to_record(item) for item in items])


def question_opened(
    question: HotelierQuestion, now: datetime, blocked_searches: int = 0
) -> Notification:
    return notification(
        hotel_id=question.hotel_id,
        kind=NotificationKind.QUESTION_OPENED,
        created_at=now,
        characteristic_key=question.characteristic_key,
        question_id=question.id,
        payload={"reason": question.reason.value, "blocked_searches": blocked_searches},
    )


def answer_accepted(question: HotelierQuestion, fact: Fact, now: datetime) -> Notification:
    return notification(
        hotel_id=question.hotel_id,
        kind=NotificationKind.ANSWER_ACCEPTED,
        created_at=now,
        characteristic_key=question.characteristic_key,
        question_id=question.id,
        fact_id=fact.id,
        payload={"value": primitive(fact.value), "fields": len(fact.qualifiers)},
    )


def answer_needs_detail(question: HotelierQuestion, now: datetime) -> Notification:
    return notification(
        hotel_id=question.hotel_id,
        kind=NotificationKind.ANSWER_NEEDS_DETAIL,
        created_at=now,
        characteristic_key=question.characteristic_key,
        question_id=question.id,
        bucket=now.date().isoformat(),
    )


def conflict_raised(record: ConflictRecord, hotel_id: str, now: datetime) -> Notification:
    pending = record.resolution == PENDING
    return notification(
        hotel_id=HotelId(hotel_id),
        kind=NotificationKind.CONFLICT_OPENED if pending else NotificationKind.CONFLICT_RESOLVED,
        created_at=now,
        characteristic_key=record.characteristic_key,
        conflict_id=ConflictId(record.id),
        payload={
            "rule": record.rule,
            "resolution": record.resolution,
            "versions": len(record.fact_ids),
        },
    )


def conflicts_raised(
    records: Sequence[ConflictRecord], hotel_id: str, now: datetime
) -> tuple[Notification, ...]:
    return tuple(conflict_raised(record, hotel_id, now) for record in records)


def fact_changed(
    previous: SearchFactRecord, fresh: SearchFactRecord, now: datetime
) -> Notification:
    was_confirmed = previous.status == FactStatus.CONFIRMED_BY_HOTELIER.value
    return notification(
        hotel_id=HotelId(fresh.hotel_id),
        kind=NotificationKind.FACT_CHANGED,
        created_at=now,
        characteristic_key=fresh.characteristic_key,
        fact_id=FactId(fresh.id),
        severity=change_severity(was_confirmed_by_hotelier=was_confirmed),
        payload={
            "previous": primitive(previous.value),
            "current": primitive(fresh.value),
            "method": fresh.method,
            "was_confirmed_by_hotelier": was_confirmed,
        },
    )


def fact_expiring(record: SearchFactRecord, now: datetime) -> Notification:
    left = record.valid_until - now if record.valid_until is not None else None
    return notification(
        hotel_id=HotelId(record.hotel_id),
        kind=NotificationKind.FACT_EXPIRING,
        created_at=now,
        characteristic_key=record.characteristic_key,
        fact_id=FactId(record.id),
        severity=Severity.ACTION
        if record.status == FactStatus.CONFIRMED_BY_HOTELIER.value
        else Severity.INFO,
        payload={
            "days_left": round(left.total_seconds() / 86400.0, 1) if left else 0.0,
            "method": record.method,
            "source_type": record.source_type,
            "value": primitive(record.value),
        },
    )


def search_demand(
    hotel_id: str,
    characteristic_key: str,
    *,
    blocked_searches: int,
    appearances: int,
    window_days: int,
    now: datetime,
) -> Notification:
    return notification(
        hotel_id=HotelId(hotel_id),
        kind=NotificationKind.SEARCH_DEMAND,
        created_at=now,
        characteristic_key=characteristic_key,
        bucket=now.date().isoformat(),
        payload={
            "blocked_searches": blocked_searches,
            "appearances": appearances,
            "window_days": window_days,
        },
    )


def primitive(value: object) -> NotificationValue:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    return None
