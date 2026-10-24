from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import Conflict, Fact, FactStatus, Resolution
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.services.confidence import effective
from hotel_agent.domain.value_objects import ConflictId, FactId

RULE = "hotelier > fresh_computed > osm_tag > stale_computed"
CLOSE_ENOUGH = 0.05
HOTELIER_SOURCES = frozenset({SourceType.HOTELIER, SourceType.LLM_EXTRACTION})
COMPUTED_SOURCES = frozenset({SourceType.COMPUTED, SourceType.DEM, SourceType.OPEN_METEO})


@dataclass(frozen=True, slots=True, kw_only=True)
class Resolved:
    winner: Fact
    losers: tuple[Fact, ...]
    conflict: Conflict | None


def resolve(
    facts: Sequence[Fact], now: datetime, tolerance: float, conflict_id: ConflictId
) -> Resolved:
    candidates = [fact for fact in facts if fact.status is not FactStatus.COMPUTING]
    if not candidates:
        raise InvalidValue("Nothing to resolve: every fact is still computing")
    ranked = sorted(candidates, key=lambda fact: _rank(fact, now), reverse=True)
    winner, rest = ranked[0], tuple(ranked[1:])
    disagreeing = tuple(fact for fact in rest if _differs(winner.value, fact.value, tolerance))
    if not disagreeing:
        return Resolved(winner=winner.at(now), losers=rest, conflict=None)
    if _too_close(winner, disagreeing[0], now):
        return _pending(winner, rest, disagreeing, conflict_id)
    return _by_rule(winner, rest, disagreeing, now, conflict_id)


def _by_rule(
    winner: Fact,
    rest: Sequence[Fact],
    disagreeing: Sequence[Fact],
    now: datetime,
    conflict_id: ConflictId,
) -> Resolved:
    return Resolved(
        winner=winner.at(now),
        losers=tuple(fact.superseded_by(winner) for fact in rest),
        conflict=_conflict(
            conflict_id,
            winner,
            disagreeing,
            Resolution.RESOLVED_BY_RULE,
            winner.id,
        ),
    )


def _pending(
    winner: Fact, rest: Sequence[Fact], disagreeing: Sequence[Fact], conflict_id: ConflictId
) -> Resolved:
    return Resolved(
        winner=winner.conflicted(),
        losers=tuple(fact.conflicted() for fact in rest),
        conflict=_conflict(conflict_id, winner, disagreeing, Resolution.PENDING, None),
    )


def _conflict(
    conflict_id: ConflictId,
    winner: Fact,
    disagreeing: Sequence[Fact],
    resolution: Resolution,
    winner_fact_id: FactId | None,
) -> Conflict:
    return Conflict(
        id=conflict_id,
        characteristic_key=winner.characteristic_key,
        subject=winner.subject,
        fact_ids=(winner.id, *(fact.id for fact in disagreeing)),
        resolution=resolution,
        rule=RULE,
        winner_fact_id=winner_fact_id,
    )


def _rank(fact: Fact, now: datetime) -> tuple[int, float, datetime]:
    return (tier(fact, now), effective(fact.provenance, now).value, fact.provenance.computed_at)


def tier(fact: Fact, now: datetime) -> int:
    source = fact.provenance.source_type
    if source in HOTELIER_SOURCES:
        return 3
    if source in COMPUTED_SOURCES:
        return 0 if fact.is_stale_at(now) else 2
    return 1


def _too_close(winner: Fact, challenger: Fact, now: datetime) -> bool:
    if tier(winner, now) != tier(challenger, now):
        return False
    gap = effective(winner.provenance, now).value - effective(challenger.provenance, now).value
    return gap < CLOSE_ENOUGH


def _differs(left: object, right: object, tolerance: float) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return left is not right
    if isinstance(left, int | float) and isinstance(right, int | float):
        return abs(float(left) - float(right)) > tolerance
    return left != right
