from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import datetime

from hotel_agent.domain.entities import Fact, FactStatus


@dataclass(frozen=True, slots=True, kw_only=True)
class Coverage:
    total: int
    known: int
    confirmed: int
    stale: int
    disputed: int

    @property
    def unknown(self) -> int:
        return max(self.total - self.known, 0)

    @property
    def completeness(self) -> float:
        return self.known / self.total if self.total else 0.0


def coverage(
    keys: Sequence[str],
    facts: Sequence[Fact],
    disputed_keys: Collection[str],
    now: datetime,
) -> Coverage:
    wanted = set(keys)
    current = {
        fact.characteristic_key: fact
        for fact in facts
        if fact.characteristic_key in wanted and fact.status is not FactStatus.SUPERSEDED
    }
    return Coverage(
        total=len(wanted),
        known=sum(1 for fact in current.values() if fact.value is not None),
        confirmed=sum(
            1 for fact in current.values() if fact.status is FactStatus.CONFIRMED_BY_HOTELIER
        ),
        stale=sum(1 for fact in current.values() if fact.is_stale_at(now)),
        disputed=len(wanted & set(disputed_keys)),
    )
