from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import StrEnum
from typing import Any

from hotel_agent.domain.characteristics import ScalarValue
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import (
    Azimuth,
    BuildingId,
    Confidence,
    ConflictId,
    FacadeId,
    FactId,
    GeoFeatureId,
    HotelId,
    LonLat,
    Provenance,
    QuestionId,
    RoomId,
    Subject,
)

type FactValue = ScalarValue | Mapping[str, ScalarValue]
type QualifierValue = bool | float | str | tuple[float, ...]
type Geometry = Mapping[str, Any]


class FactStatus(StrEnum):
    ACTIVE = "active"
    CONFLICTED = "conflicted"
    SUPERSEDED = "superseded"
    CONFIRMED_BY_HOTELIER = "confirmed_by_hotelier"
    STALE = "stale"
    COMPUTING = "computing"


class GeoFeatureKind(StrEnum):
    ROUTE = "route"
    POI = "poi"
    AREA = "area"
    LINE = "line"
    VIEWSHED = "viewshed"
    FACADE = "facade"


class Resolution(StrEnum):
    PENDING = "pending"
    RESOLVED_BY_RULE = "resolved_by_rule"
    RESOLVED_BY_HOTELIER = "resolved_by_hotelier"


class QuestionReason(StrEnum):
    MISSING = "missing"
    CONFLICT = "conflict"
    STALE = "stale"
    LOW_CONFIDENCE = "low_confidence"


class QuestionStatus(StrEnum):
    OPEN = "open"
    ANSWERED = "answered"
    SKIPPED = "skipped"


SETTLED_STATUSES = frozenset({FactStatus.SUPERSEDED, FactStatus.COMPUTING})
RESTRICTING_QUALIFIERS = frozenset(
    {"from_floor", "months", "facade_azimuth", "estimated_location", "estimated_view"}
)


@dataclass(frozen=True, slots=True, kw_only=True)
class Fact:
    id: FactId
    subject: Subject
    characteristic_key: str
    value: FactValue
    unit: str | None = None
    qualifiers: Mapping[str, QualifierValue] = field(default_factory=dict)
    provenance: Provenance
    status: FactStatus = FactStatus.ACTIVE
    geo_refs: tuple[GeoFeatureId, ...] = ()
    explanation: str = ""

    def __post_init__(self) -> None:
        if not self.characteristic_key:
            raise InvalidValue("Fact has no characteristic key")
        if self.status is FactStatus.COMPUTING and self.value is not None:
            raise InvalidValue("A computing fact carries no value yet")

    @property
    def confidence(self) -> Confidence:
        return self.provenance.confidence

    def is_stale_at(self, now: datetime) -> bool:
        return self.provenance.is_expired_at(now)

    def is_restricted(self) -> bool:
        return bool(RESTRICTING_QUALIFIERS.intersection(self.qualifiers))

    def at(self, now: datetime) -> "Fact":
        if self.status in SETTLED_STATUSES or not self.is_stale_at(now):
            return self
        return replace(self, status=FactStatus.STALE)

    def superseded_by(self, winner: "Fact") -> "Fact":
        if winner.id == self.id:
            raise InvalidValue("A fact cannot supersede itself")
        return replace(self, status=FactStatus.SUPERSEDED)

    def conflicted(self) -> "Fact":
        return replace(self, status=FactStatus.CONFLICTED)


@dataclass(frozen=True, slots=True, kw_only=True)
class Building:
    id: BuildingId
    footprint: Geometry
    height_m: float
    min_height_m: float = 0.0
    levels: int | None = None
    ground_elevation_m: float = 0.0
    roof_shape: str | None = None
    hotel_id: HotelId | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Facade:
    id: FacadeId
    hotel_id: HotelId
    azimuth: Azimuth
    label: str
    geometry: Geometry


@dataclass(frozen=True, slots=True, kw_only=True)
class Room:
    id: RoomId
    hotel_id: HotelId
    name: str
    capacity: int
    floor_range: tuple[int, int]
    facade_ids: tuple[FacadeId, ...] = ()


@dataclass(frozen=True, slots=True, kw_only=True)
class Hotel:
    id: HotelId
    name: str
    location: LonLat
    building_id: BuildingId
    stars: int | None = None
    address: str | None = None
    thumbnail_url: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class GeoFeature:
    id: GeoFeatureId
    kind: GeoFeatureKind
    characteristic_key: str
    geometry: Geometry
    name: str | None = None
    label: str | None = None
    osm_ref: str | None = None
    style_hint: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Conflict:
    id: ConflictId
    characteristic_key: str
    subject: Subject
    fact_ids: tuple[FactId, ...]
    resolution: Resolution
    rule: str
    winner_fact_id: FactId | None = None

    def __post_init__(self) -> None:
        if len(self.fact_ids) < 2:
            raise InvalidValue("A conflict needs at least two facts")
        if self.resolution is Resolution.PENDING and self.winner_fact_id is not None:
            raise InvalidValue("A pending conflict has no winner")
        if self.resolution is not Resolution.PENDING and self.winner_fact_id is None:
            raise InvalidValue("A resolved conflict names its winner")


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelierQuestion:
    id: QuestionId
    hotel_id: HotelId
    characteristic_key: str
    text: str
    reason: QuestionReason
    created_at: datetime
    status: QuestionStatus = QuestionStatus.OPEN

    def answered(self) -> "HotelierQuestion":
        if self.status is not QuestionStatus.OPEN:
            raise InvalidValue(f"Question {self.id} is already {self.status}")
        return replace(self, status=QuestionStatus.ANSWERED)

    def skipped(self) -> "HotelierQuestion":
        if self.status is not QuestionStatus.OPEN:
            raise InvalidValue(f"Question {self.id} is already {self.status}")
        return replace(self, status=QuestionStatus.SKIPPED)


def facts_by_characteristic(facts: Sequence[Fact]) -> dict[str, list[Fact]]:
    grouped: dict[str, list[Fact]] = {}
    for fact in facts:
        grouped.setdefault(fact.characteristic_key, []).append(fact)
    return grouped
