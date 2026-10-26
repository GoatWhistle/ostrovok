from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from itertools import count
from typing import Any, Self, cast

from hotel_agent.application.dto import (
    ConflictRecord,
    QuestionCandidate,
    QuestionRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.ports.repositories import UnitOfWork

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
        return [item for item in self._view().values() if item.hotel_id == hotel_id]

    async def get(self, question_id: str, lock: bool = False) -> QuestionRecord | None:
        return self._view().get(question_id)

    async def record_answer(
        self, question_id: str, status: str, answer_text: str, answered_at: datetime
    ) -> None:
        current = self._view()[question_id]
        self._pending["questions"][question_id] = replace(
            current, status=status, answer_text=answer_text
        )

    async def candidates(
        self, region: str, characteristic_keys: Sequence[str]
    ) -> Sequence[QuestionCandidate]:
        taken = {(item.hotel_id, item.characteristic_key) for item in self._view().values()}
        known = {
            (item.hotel_id, item.characteristic_key)
            for item in self._store.facts.values()
            if item.status != "superseded"
        }
        return [
            QuestionCandidate(hotel_id=hotel, hotel_name=f"Hotel {hotel}", characteristic_key=key)
            for hotel in sorted(self._store.hotels)
            for key in characteristic_keys
            if (hotel, key) not in taken | known
        ]

    async def add(self, records: Sequence[QuestionRecord]) -> int:
        fresh = [item for item in records if item.id not in self._view()]
        for item in fresh:
            self._pending["questions"][item.id] = item
        return len(fresh)

    def _view(self) -> dict[str, QuestionRecord]:
        return {**self._store.questions, **self._pending["questions"]}


class FakeSearch:
    def __init__(self, store: Store) -> None:
        self._store = store

    async def get_hotel(self, hotel_id: str) -> SearchHotelRecord | None:
        if hotel_id not in self._store.hotels:
            return None
        return cast(SearchHotelRecord, object())


class FakeUnitOfWork:
    def __init__(self, store: Store) -> None:
        self._store = store
        self._pending: dict[str, Any] = {"facts": {}, "conflicts": {}, "questions": {}}
        self.facts = FakeFacts(store, self._pending)
        self.questions = FakeQuestions(store, self._pending)
        self.search = FakeSearch(store)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        self._pending.update({"facts": {}, "conflicts": {}, "questions": {}})

    async def commit(self) -> None:
        self._store.facts.update(self._pending["facts"])
        self._store.conflicts.update(self._pending["conflicts"])
        self._store.questions.update(self._pending["questions"])
        self._pending.update({"facts": {}, "conflicts": {}, "questions": {}})
        self._store.commits += 1


def factory(store: Store) -> Any:
    return lambda: cast(UnitOfWork, FakeUnitOfWork(store))
