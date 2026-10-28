from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from hotel_agent.domain.characteristics import Op, ScalarValue
from hotel_agent.domain.entities import Fact, FactStatus, FactValue
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.confidence import aggregate, effective

PARTIAL_SLACK = 1.5
MARGIN_CAP = 2.0
MARGIN_SHARE = 0.1


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
    margin: float | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Scored:
    score: float
    matches: tuple[PropertyMatch, ...]
    disqualified: bool
    confidence: float = 0.0


def score(intents: Sequence[Intent], facts: Mapping[str, Fact], now: datetime) -> Scored:
    matches = tuple(match(intent, facts.get(intent.characteristic_key), now) for intent in intents)
    missed = any(item.intent.required and item.quality is MatchQuality.NONE for item in matches)
    total_weight = sum(item.intent.weight for item in matches)
    if missed or total_weight <= 0.0:
        return Scored(score=0.0, matches=matches, disqualified=missed, confidence=0.0)
    earned = sum(_contribution(item, now) for item in matches)
    return Scored(
        score=earned / total_weight,
        matches=matches,
        disqualified=False,
        confidence=_confidence(matches, now),
    )


def match(intent: Intent, fact: Fact | None, now: datetime) -> PropertyMatch:
    if fact is None:
        return PropertyMatch(intent=intent, fact=None, quality=MatchQuality.UNKNOWN)
    if fact.status is FactStatus.COMPUTING:
        return PropertyMatch(intent=intent, fact=fact, quality=MatchQuality.COMPUTING)
    quality = _quality(intent, fact.value)
    if quality is MatchQuality.FULL and (fact.is_restricted() or fact.is_stale_at(now)):
        quality = MatchQuality.PARTIAL
    return PropertyMatch(intent=intent, fact=fact, quality=quality, margin=_margin(intent, fact))


def _confidence(matches: Sequence[PropertyMatch], now: datetime) -> float:
    counted = [
        effective(item.fact.provenance, now)
        for item in matches
        if item.fact is not None and item.quality in COUNTED_QUALITIES
    ]
    return aggregate(counted).value if counted else 0.0


def _margin(intent: Intent, fact: Fact) -> float | None:
    direct = _ratio(fact.value, intent.value, intent.op)
    if direct is not None:
        return direct
    return _ratio(
        fact.qualifiers.get("native_value"),
        fact.qualifiers.get("native_threshold"),
        fact.qualifiers.get("native_op"),
    )


def _ratio(value: object, wanted: object, op: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    if isinstance(wanted, bool) or not isinstance(wanted, int | float) or wanted <= 0:
        return None
    if op in {Op.GTE, str(Op.GTE)} and value > 0:
        return min(value / wanted, MARGIN_CAP)
    if op in {Op.LTE, str(Op.LTE)} and value > 0:
        return min(wanted / value, MARGIN_CAP)
    return None


def _contribution(item: PropertyMatch, now: datetime) -> float:
    if item.fact is None or item.quality not in COUNTED_QUALITIES:
        return 0.0
    confidence = effective(item.fact.provenance, now).value
    return item.intent.weight * _graded(item) * confidence


def _graded(item: PropertyMatch) -> float:
    base = WEIGHT_OF_QUALITY[item.quality]
    if item.margin is None:
        return base
    slack = min(max(item.margin, 0.0), MARGIN_CAP) - 1.0
    return base * (1.0 + MARGIN_SHARE * slack)


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
