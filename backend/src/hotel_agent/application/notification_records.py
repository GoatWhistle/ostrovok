from hotel_agent.application.dto import NotificationRecord
from hotel_agent.domain.notifications import (
    Notification,
    NotificationId,
    NotificationKind,
    Severity,
)
from hotel_agent.domain.value_objects import ConflictId, FactId, HotelId, QuestionId


def notification_from_record(record: NotificationRecord) -> Notification:
    return Notification(
        id=NotificationId(record.id),
        hotel_id=HotelId(record.hotel_id),
        kind=NotificationKind(record.kind),
        severity=Severity(record.severity),
        created_at=record.created_at,
        dedup_key=record.dedup_key,
        characteristic_key=record.characteristic_key,
        question_id=QuestionId(record.question_id) if record.question_id else None,
        fact_id=FactId(record.fact_id) if record.fact_id else None,
        conflict_id=ConflictId(record.conflict_id) if record.conflict_id else None,
        payload=dict(record.payload),
        read_at=record.read_at,
    )


def notification_to_record(item: Notification) -> NotificationRecord:
    return NotificationRecord(
        id=str(item.id),
        hotel_id=str(item.hotel_id),
        kind=item.kind.value,
        severity=item.severity.value,
        created_at=item.created_at,
        dedup_key=item.dedup_key,
        characteristic_key=item.characteristic_key,
        question_id=str(item.question_id) if item.question_id else None,
        fact_id=str(item.fact_id) if item.fact_id else None,
        conflict_id=str(item.conflict_id) if item.conflict_id else None,
        payload=dict(item.payload),
        read_at=item.read_at,
    )
