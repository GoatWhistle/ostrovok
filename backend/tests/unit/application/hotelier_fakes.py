from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from itertools import count
from typing import Any, Self, cast

from hotel_agent.application.dto import (
    ConflictRecord,
    DemandRecord,
    FeedCursor,
    NotificationCounters,
    NotificationPage,
    NotificationRecord,
    QuestionCandidate,
    QuestionRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.application.room_records import RoomRecord

NOW = datetime(2026, 10, 26, 12, tzinfo=UTC)
LIVE = {"active", "confirmed_by_hotelier"}


class FixedClock:
    def now(self) -> datetime:
        return NOW


class Ids:
    issued = count(1)

    def __call__(self, prefix: str) -> str:
        return f"{prefix}_{next(self.issued)}"


def computed_fact(
    fact_id: str, hotel_id: str, key: str, value: object, status: str = "active"
) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id=hotel_id,
        id=fact_id,
        characteristic_key=key,
        value=value,
        unit=None,
        qualifiers={},
        source_type="computed",
        source_id=None,
        method=f"{key}@1",
        confidence=0.85,
        computed_at=NOW - timedelta(days=3),
        valid_until=NOW + timedelta(days=60),
        status=status,
        geo_refs=(),
        explanation="",
        facade_azimuth=None,
        subject_id=hotel_id,
    )


def question(question_id: str, hotel_id: str, key: str) -> QuestionRecord:
    return QuestionRecord(
        id=question_id,
        hotel_id=hotel_id,
        characteristic_key=key,
        text="?",
        reason="missing",
        status="open",
        created_at=NOW - timedelta(days=1),
    )


@dataclass
class Store:
    hotels: set[str] = field(default_factory=lambda: {"h1", "h2"})
    facts: dict[str, SearchFactRecord] = field(default_factory=dict)
    conflicts: dict[str, ConflictRecord] = field(default_factory=dict)
    questions: dict[str, QuestionRecord] = field(default_factory=dict)
    notifications: dict[str, NotificationRecord] = field(default_factory=dict)
    hotel_records: dict[str, SearchHotelRecord] = field(default_factory=dict)
    demand: list[DemandRecord] = field(default_factory=list)
    appearances: int = 0
    commits: int = 0


class FakeFacts:
    def __init__(self, store: Store, pending: dict[str, Any]) -> None:
        self._store, self._pending = store, pending

    async def lock_hotel(self, hotel_id: str) -> bool:
        return hotel_id in self._store.hotels

    async def get(self, fact_id: str, lock: bool = False) -> SearchFactRecord | None:
        return self._view().get(fact_id)

    async def versions(
        self, subject_type: str, subject_id: str, characteristic_key: str
    ) -> Sequence[SearchFactRecord]:
        return sorted(
            (
                item
                for item in self._view().values()
                if (item.subject_id or item.hotel_id) == subject_id
                and item.characteristic_key == characteristic_key
            ),
            key=lambda item: item.computed_at,
            reverse=True,
        )

    async def save(self, records: Sequence[SearchFactRecord]) -> None:
        for record in records:
            view = self._view()
            if record.status in LIVE and any(
                other.id != record.id
                and other.status in LIVE
                and other.subject_id == record.subject_id
                and other.characteristic_key == record.characteristic_key
                for other in view.values()
            ):
                raise AssertionError("facts_active_subject_characteristic_uq")
            self._pending["facts"][record.id] = record

    async def conflicts(
        self, hotel_id: str, fact_id: str | None = None
    ) -> Sequence[ConflictRecord]:
        merged = {**self._store.conflicts, **self._pending["conflicts"]}
        return [
            item
            for item in merged.values()
            if item.subject_id == hotel_id and (fact_id is None or fact_id in item.fact_ids)
        ]

    async def save_conflicts(self, records: Sequence[ConflictRecord]) -> None:
        for record in records:
            self._pending["conflicts"][record.id] = record

    def _view(self) -> dict[str, SearchFactRecord]:
        return {**self._store.facts, **self._pending["facts"]}


class FakeQuestions:
    def __init__(self, store: Store, pending: dict[str, Any]) -> None:
        self._store, self._pending = store, pending

    async def for_hotel(self, hotel_id: str) -> Sequence[QuestionRecord]:
        return [self._linked(item) for item in self._view().values() if item.hotel_id == hotel_id]

    async def get(self, question_id: str, lock: bool = False) -> QuestionRecord | None:
        found = self._view().get(question_id)
        return self._linked(found) if found else None

    async def record_answer(
        self, question_id: str, status: str, answer_text: str, answered_at: datetime
    ) -> None:
        current = self._view()[question_id]
        self._pending["questions"][question_id] = replace(
            current, status=status, answer_text=answer_text, answered_at=answered_at
        )

    async def set_status(self, question_id: str, status: str) -> None:
        current = self._view()[question_id]
        self._pending["questions"][question_id] = replace(current, status=status)

    def _linked(self, record: QuestionRecord) -> QuestionRecord:
        facts = {**self._store.facts, **self._pending["facts"]}.values()
        linked = sorted(
            (item.computed_at, item.id)
            for item in facts
            if item.source_type == "hotelier" and item.source_id == record.id
        )
        return replace(record, answer_fact_ids=tuple(fact_id for _, fact_id in linked))

    async def candidates(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        hotel_ids: Sequence[str] | None = None,
        limit: int = 1000,
    ) -> Sequence[QuestionCandidate]:
        taken = {(item.hotel_id, item.characteristic_key) for item in self._view().values()}
        known = {
            (item.hotel_id, item.characteristic_key)
            for item in self._store.facts.values()
            if item.status != "superseded"
        }
        wanted = set(hotel_ids) if hotel_ids is not None else self._store.hotels
        return [
            QuestionCandidate(hotel_id=hotel, hotel_name=f"Hotel {hotel}", characteristic_key=key)
            for hotel in sorted(self._store.hotels & wanted)
            for key in characteristic_keys
            if (hotel, key) not in taken | known
        ][:limit]

    async def add(self, records: Sequence[QuestionRecord]) -> int:
        fresh = [item for item in records if item.id not in self._view()]
        for item in fresh:
            self._pending["questions"][item.id] = item
        return len(fresh)

    def _view(self) -> dict[str, QuestionRecord]:
        return {**self._store.questions, **self._pending["questions"]}


class FakeNotifications:
    def __init__(self, store: Store, pending: dict[str, Any]) -> None:
        self._store, self._pending = store, pending

    async def add(self, records: Sequence[NotificationRecord]) -> int:
        view = self._view()
        taken = {(item.hotel_id, item.dedup_key) for item in view.values()}
        written = 0
        for record in records:
            if record.id in view or (record.hotel_id, record.dedup_key) in taken:
                continue
            self._pending["notifications"][record.id] = record
            taken.add((record.hotel_id, record.dedup_key))
            written += 1
        return written

    async def page(
        self,
        hotel_id: str,
        *,
        unread_only: bool = False,
        cursor: FeedCursor | None = None,
        limit: int = 50,
    ) -> NotificationPage:
        rows = sorted(
            (
                item
                for item in self._view().values()
                if item.hotel_id == hotel_id and (not unread_only or item.read_at is None)
            ),
            key=lambda item: (item.created_at, item.id),
            reverse=True,
        )
        if cursor is not None:
            rows = [
                item for item in rows if (item.created_at, item.id) < (cursor.created_at, cursor.id)
            ]
        if len(rows) <= limit:
            return NotificationPage(items=tuple(rows))
        last = rows[limit - 1]
        return NotificationPage(
            items=tuple(rows[:limit]),
            next_cursor=FeedCursor(created_at=last.created_at, id=last.id),
        )

    async def unread_counts(self, hotel_id: str) -> NotificationCounters:
        rows = [
            item
            for item in self._view().values()
            if item.hotel_id == hotel_id and item.read_at is None
        ]
        by_kind: dict[str, int] = {}
        for item in rows:
            by_kind[item.kind] = by_kind.get(item.kind, 0) + 1
        return NotificationCounters(
            total=len(rows),
            action=sum(1 for item in rows if item.severity == "action"),
            by_kind=by_kind,
        )

    async def mark_read(self, hotel_id: str, ids: Sequence[str], now: datetime) -> int:
        wanted = set(ids)
        return self._mark(
            now,
            lambda item: item.hotel_id == hotel_id and item.id in wanted and item.read_at is None,
        )

    async def mark_all_read(self, hotel_id: str, now: datetime) -> int:
        return self._mark(now, lambda item: item.hotel_id == hotel_id and item.read_at is None)

    def _mark(self, now: datetime, matches: Any) -> int:
        changed = 0
        for item in self._view().values():
            if matches(item):
                self._pending["notifications"][item.id] = replace(item, read_at=now)
                changed += 1
        return changed

    def _view(self) -> dict[str, NotificationRecord]:
        return {**self._store.notifications, **self._pending["notifications"]}


class FakeDemand:
    def __init__(self, store: Store) -> None:
        self._store = store

    async def for_hotel(self, hotel_id: str, since: datetime) -> Sequence[DemandRecord]:
        return [item for item in self._store.demand if item.hotel_id == hotel_id]

    async def appearances(self, hotel_id: str, since: datetime) -> int:
        return self._store.appearances

    async def unknown_counts(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        since: datetime,
        limit: int = 2000,
    ) -> Sequence[DemandRecord]:
        wanted = set(characteristic_keys)
        return [
            item
            for item in self._store.demand
            if item.characteristic_key in wanted and item.blocked > 0
        ][:limit]


LIVE_OR_STALE = {"active", "stale", "confirmed_by_hotelier"}


class FakeSearch:
    def __init__(self, store: Store) -> None:
        self._store = store

    async def get_hotel(self, hotel_id: str) -> SearchHotelRecord | None:
        if hotel_id not in self._store.hotels:
            return None
        known = self._store.hotel_records.get(hotel_id)
        return known if known is not None else cast(SearchHotelRecord, object())

    async def list_facts(
        self,
        region: str | None,
        hotel_id: str | None = None,
        hotel_ids: Sequence[str] | None = None,
        characteristic_keys: Sequence[str] | None = None,
    ) -> Sequence[SearchFactRecord]:
        wanted = set(characteristic_keys or ())
        return [
            item
            for item in self._store.facts.values()
            if (hotel_id is None or item.hotel_id == hotel_id)
            and (not wanted or item.characteristic_key in wanted)
        ]

    async def expiring_facts(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        horizon: datetime,
        limit: int = 500,
    ) -> Sequence[SearchFactRecord]:
        wanted = set(characteristic_keys)
        rows = [
            item
            for item in self._store.facts.values()
            if item.characteristic_key in wanted
            and item.status in LIVE_OR_STALE
            and item.valid_until is not None
            and item.valid_until <= horizon
        ]
        return sorted(rows, key=lambda item: (item.valid_until or horizon, item.id))[:limit]

    async def list_rooms(self, hotel_id: str) -> Sequence[RoomRecord]:
        return []


class FakeUnitOfWork:
    def __init__(self, store: Store) -> None:
        self._store = store
        self._pending: dict[str, Any] = {
            "facts": {},
            "conflicts": {},
            "questions": {},
            "notifications": {},
        }
        self.facts = FakeFacts(store, self._pending)
        self.questions = FakeQuestions(store, self._pending)
        self.notifications = FakeNotifications(store, self._pending)
        self.demand = FakeDemand(store)
        self.search = FakeSearch(store)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        self._pending.update(_empty())

    async def commit(self) -> None:
        self._store.facts.update(self._pending["facts"])
        self._store.conflicts.update(self._pending["conflicts"])
        self._store.questions.update(self._pending["questions"])
        self._store.notifications.update(self._pending["notifications"])
        self._pending.update(_empty())
        self._store.commits += 1


def _empty() -> dict[str, Any]:
    return {"facts": {}, "conflicts": {}, "questions": {}, "notifications": {}}


def factory(store: Store) -> Any:
    return lambda: cast(UnitOfWork, FakeUnitOfWork(store))
