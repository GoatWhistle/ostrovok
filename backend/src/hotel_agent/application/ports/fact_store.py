from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from hotel_agent.application.dto import (
    ConflictRecord,
    QuestionCandidate,
    QuestionRecord,
    SearchFactRecord,
)


class FactStore(Protocol):
    async def lock_hotel(self, hotel_id: str) -> bool: ...

    async def get(self, fact_id: str, lock: bool = False) -> SearchFactRecord | None: ...

    async def versions(
        self, subject_type: str, subject_id: str, characteristic_key: str
    ) -> Sequence[SearchFactRecord]: ...

    async def save(self, records: Sequence[SearchFactRecord]) -> None: ...

    async def conflicts(
        self, hotel_id: str, fact_id: str | None = None
    ) -> Sequence[ConflictRecord]: ...

    async def save_conflicts(self, records: Sequence[ConflictRecord]) -> None: ...

    async def retire_expired(self, region: str, now: datetime) -> int: ...


class QuestionStore(Protocol):
    async def for_hotel(self, hotel_id: str) -> Sequence[QuestionRecord]: ...

    async def get(self, question_id: str, lock: bool = False) -> QuestionRecord | None: ...

    async def record_answer(
        self, question_id: str, status: str, answer_text: str, answered_at: datetime
    ) -> None: ...

    async def set_status(self, question_id: str, status: str) -> None: ...

    async def prune(self, region: str) -> int: ...

    async def set_statuses(self, question_ids: Sequence[str], status: str) -> int: ...

    async def open_without_demand(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        backed: Sequence[tuple[str, str]],
    ) -> Sequence[str]: ...

    async def open_for(
        self, hotel_ids: Sequence[str], characteristic_keys: Sequence[str]
    ) -> Sequence[QuestionRecord]: ...

    async def deferred_with_demand(
        self, region: str, backed: Sequence[tuple[str, str]]
    ) -> Sequence[QuestionRecord]: ...

    async def candidates(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        hotel_ids: Sequence[str] | None = None,
        limit: int = 200,
    ) -> Sequence[QuestionCandidate]: ...

    async def add(self, records: Sequence[QuestionRecord]) -> int: ...
