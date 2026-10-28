import hashlib
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import StrEnum
from typing import NewType

from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import ConflictId, FactId, HotelId, QuestionId

NotificationId = NewType("NotificationId", str)

type NotificationValue = bool | int | float | str | None


class NotificationKind(StrEnum):
    QUESTION_OPENED = "question_opened"
    ANSWER_ACCEPTED = "answer_accepted"
    ANSWER_NEEDS_DETAIL = "answer_needs_detail"
    FACT_CHANGED = "fact_changed"
    FACT_EXPIRING = "fact_expiring"
    CONFLICT_OPENED = "conflict_opened"
    CONFLICT_RESOLVED = "conflict_resolved"
    SEARCH_DEMAND = "search_demand"


class Severity(StrEnum):
    ACTION = "action"
    INFO = "info"


SEVERITY_BY_KIND = {
    NotificationKind.QUESTION_OPENED: Severity.ACTION,
    NotificationKind.ANSWER_NEEDS_DETAIL: Severity.ACTION,
    NotificationKind.CONFLICT_OPENED: Severity.ACTION,
    NotificationKind.FACT_EXPIRING: Severity.ACTION,
    NotificationKind.SEARCH_DEMAND: Severity.ACTION,
    NotificationKind.ANSWER_ACCEPTED: Severity.INFO,
    NotificationKind.CONFLICT_RESOLVED: Severity.INFO,
    NotificationKind.FACT_CHANGED: Severity.INFO,
}
REFERENCED_KINDS = frozenset(
    kind for kind in NotificationKind if kind is not NotificationKind.SEARCH_DEMAND
)


@dataclass(frozen=True, slots=True, kw_only=True)
class Notification:
    id: NotificationId
    hotel_id: HotelId
    kind: NotificationKind
    severity: Severity
    created_at: datetime
    dedup_key: str
    characteristic_key: str | None = None
    question_id: QuestionId | None = None
    fact_id: FactId | None = None
    conflict_id: ConflictId | None = None
    payload: Mapping[str, NotificationValue] = field(default_factory=dict)
    read_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.hotel_id:
            raise InvalidValue("Notification has no hotel")
        if not self.dedup_key:
            raise InvalidValue("Notification has no deduplication key")
        if self.kind in REFERENCED_KINDS and not self.references:
            raise InvalidValue(f"Notification {self.kind.value} carries no reference")
        if self.read_at is not None and self.read_at < self.created_at:
            raise InvalidValue("Notification cannot be read before it was created")

    @property
    def references(self) -> tuple[str, ...]:
        return tuple(
            str(item)
            for item in (self.question_id, self.fact_id, self.conflict_id)
            if item is not None
        )

    @property
    def is_unread(self) -> bool:
        return self.read_at is None

    @property
    def needs_action(self) -> bool:
        return self.severity is Severity.ACTION and self.read_at is None

    def read(self, now: datetime) -> "Notification":
        if self.read_at is not None:
            return self
        return replace(self, read_at=max(now, self.created_at))


def dedup_key(
    kind: NotificationKind,
    *,
    characteristic_key: str | None = None,
    question_id: QuestionId | None = None,
    fact_id: FactId | None = None,
    conflict_id: ConflictId | None = None,
    bucket: str | None = None,
) -> str:
    return "|".join(
        (
            kind.value,
            characteristic_key or "",
            str(question_id or ""),
            str(fact_id or ""),
            str(conflict_id or ""),
            bucket or "",
        )
    )


def notification_id(hotel_id: HotelId, key: str) -> NotificationId:
    digest = hashlib.sha256(f"{hotel_id}\x00{key}".encode()).hexdigest()[:16]
    return NotificationId(f"n_{digest}")


def notification(
    *,
    hotel_id: HotelId,
    kind: NotificationKind,
    created_at: datetime,
    characteristic_key: str | None = None,
    question_id: QuestionId | None = None,
    fact_id: FactId | None = None,
    conflict_id: ConflictId | None = None,
    payload: Mapping[str, NotificationValue] | None = None,
    bucket: str | None = None,
    severity: Severity | None = None,
) -> Notification:
    key = dedup_key(
        kind,
        characteristic_key=characteristic_key,
        question_id=question_id,
        fact_id=fact_id,
        conflict_id=conflict_id,
        bucket=bucket,
    )
    return Notification(
        id=notification_id(hotel_id, key),
        hotel_id=hotel_id,
        kind=kind,
        severity=severity or SEVERITY_BY_KIND[kind],
        created_at=created_at,
        dedup_key=key,
        characteristic_key=characteristic_key,
        question_id=question_id,
        fact_id=fact_id,
        conflict_id=conflict_id,
        payload=dict(payload or {}),
    )


def change_severity(was_confirmed_by_hotelier: bool) -> Severity:
    return Severity.ACTION if was_confirmed_by_hotelier else Severity.INFO
