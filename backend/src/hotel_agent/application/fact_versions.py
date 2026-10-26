from collections.abc import Collection, Sequence
from dataclasses import dataclass, replace
from datetime import datetime

from hotel_agent.application.dto import ConflictRecord, SearchFactRecord
from hotel_agent.application.fact_records import FactOwner, fact_from_record
from hotel_agent.domain.entities import Conflict, Fact, FactStatus, Resolution
from hotel_agent.domain.services.conflict_resolver import resolve
from hotel_agent.domain.value_objects import ConflictId

CURRENT_STATUSES = frozenset(
    {FactStatus.ACTIVE, FactStatus.CONFIRMED_BY_HOTELIER, FactStatus.CONFLICTED, FactStatus.STALE}
)


@dataclass(frozen=True, slots=True, kw_only=True)
class Settlement:
    writes: tuple[Fact, ...]
    fact: Fact
    conflict: Conflict | None


def current_versions(records: Sequence[SearchFactRecord], exclude: str = "") -> tuple[Fact, ...]:
    return tuple(
        fact
        for fact in (fact_from_record(record) for record in records)
        if fact.id != exclude and fact.status in CURRENT_STATUSES
    )


def retire(facts: Sequence[Fact], winner: Fact) -> tuple[Fact, ...]:
    return tuple(fact.superseded_by(winner) for fact in facts if fact.id != winner.id)


def settle_answer(
    new: Fact, current: Sequence[Fact], now: datetime, tolerance: float, conflict_id: ConflictId
) -> Settlement:
    if not current:
        return Settlement(writes=(new,), fact=new, conflict=None)
    resolved = resolve((new, *current), now, tolerance, conflict_id)
    winner = resolved.winner
    if resolved.conflict is None:
        losers = retire(resolved.losers, winner)
    else:
        losers = resolved.losers
    final = next((fact for fact in (winner, *losers) if fact.id == new.id), new)
    return Settlement(writes=(*losers, winner), fact=final, conflict=resolved.conflict)


def conflict_record(conflict: Conflict, owner: FactOwner) -> ConflictRecord:
    return ConflictRecord(
        id=str(conflict.id),
        subject_type=owner.subject_type,
        subject_id=owner.subject_id,
        characteristic_key=conflict.characteristic_key,
        fact_ids=tuple(str(item) for item in conflict.fact_ids),
        resolution=conflict.resolution.value,
        rule=conflict.rule,
        winner_fact_id=str(conflict.winner_fact_id) if conflict.winner_fact_id else None,
    )


def settled_by_hotelier(
    conflicts: Sequence[ConflictRecord], replaced: Collection[str], winner: str
) -> tuple[ConflictRecord, ...]:
    return tuple(
        replace(
            record,
            resolution=Resolution.RESOLVED_BY_HOTELIER.value,
            winner_fact_id=winner,
        )
        for record in conflicts
        if record.resolution == Resolution.PENDING.value and set(record.fact_ids) & set(replaced)
    )
