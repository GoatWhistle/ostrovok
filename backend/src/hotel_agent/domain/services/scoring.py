from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from hotel_agent.domain.characteristics import Op, ScalarValue
from hotel_agent.domain.entities import Fact, FactStatus, FactValue
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.confidence import effective

PARTIAL_SLACK = 1.5


class MatchQuality(StrEnum):
    FULL = "full"
    PARTIAL = "partial"
    NONE = "none"
    UNKNOWN = "unknown"
    COMPUTING = "computing"


WEIGHT_OF_QUALITY = {
    MatchQuality.FULL: 1.0,
    MatchQuality.PARTIAL: 0.5,
    MatchQuality.NONE: 0.0,
    MatchQuality.UNKNOWN: 0.0,
    MatchQuality.COMPUTING: 0.0,
}
COUNTED_QUALITIES = frozenset({MatchQuality.FULL, MatchQuality.PARTIAL})


@dataclass(frozen=True, slots=True, kw_only=True)
class PropertyMatch:
    intent: Intent
    fact: Fact | None
    quality: MatchQuality


@dataclass(frozen=True, slots=True, kw_only=True)
class Scored:
    score: float
    matches: tuple[PropertyMatch, ...]
    disqualified: bool


def score(intents: Sequence[Intent], facts: Mapping[str, Fact], now: datetime) -> Scored:
    matches = tuple(match(intent, facts.get(intent.characteristic_key), now) for intent in intents)
    missed = any(item.intent.required and item.quality is MatchQuality.NONE for item in matches)
    total_weight = sum(item.intent.weight for item in matches)
    if missed or total_weight <= 0.0:
        return Scored(score=0.0, matches=matches, disqualified=missed)
    earned = sum(_contribution(item, now) for item in matches)
    return Scored(score=earned / total_weight, matches=matches, disqualified=False)


def match(intent: Intent, fact: Fact | None, now: datetime) -> PropertyMatch:
    if fact is None:
        return PropertyMatch(intent=intent, fact=None, quality=MatchQuality.UNKNOWN)
    if fact.status is FactStatus.COMPUTING:
        return PropertyMatch(intent=intent, fact=fact, quality=MatchQuality.COMPUTING)
    quality = _quality(intent, fact.value)
    if quality is MatchQuality.FULL and fact.is_restricted():
        quality = MatchQuality.PARTIAL
    return PropertyMatch(intent=intent, fact=fact, quality=quality)


def _contribution(item: PropertyMatch, now: datetime) -> float:
    if item.fact is None or item.quality not in COUNTED_QUALITIES:
        return 0.0
    confidence = effective(item.fact.provenance, now).value
    return item.intent.weight * WEIGHT_OF_QUALITY[item.quality] * confidence


def _quality(intent: Intent, value: FactValue) -> MatchQuality:
    if intent.op is Op.EXISTS:
        return MatchQuality.FULL if value is not None else MatchQuality.NONE
    if value is None:
        return MatchQuality.UNKNOWN
    if intent.op is Op.EQ:
        return MatchQuality.FULL if _same(value, intent.value) else MatchQuality.NONE
    number = _number(value)
    wanted = _number(intent.value)
    if number is None or wanted is None:
        return MatchQuality.UNKNOWN
    if intent.characteristic_key == "room_capacity" and intent.op is Op.GTE:
        return MatchQuality.FULL if number >= wanted else MatchQuality.NONE
    if intent.op is Op.GTE:
        return _ordered(number, wanted, wanted / PARTIAL_SLACK, above=True)
    return _ordered(number, wanted, wanted * PARTIAL_SLACK, above=False)


def _ordered(number: float, strict: float, lenient: float, above: bool) -> MatchQuality:
    if (number >= strict) if above else (number <= strict):
        return MatchQuality.FULL
    if (number >= lenient) if above else (number <= lenient):
        return MatchQuality.PARTIAL
    return MatchQuality.NONE


def _same(value: FactValue, wanted: ScalarValue) -> bool:
    if isinstance(value, bool) or isinstance(wanted, bool):
        return value is wanted
    if isinstance(value, Mapping):
        return False
    number, target = _number(value), _number(wanted)
    if number is not None and target is not None:
        return number == target
    return value == wanted


def _number(value: FactValue | ScalarValue) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)
