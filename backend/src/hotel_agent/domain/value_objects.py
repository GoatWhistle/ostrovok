from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import NewType, Self

from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.errors import InvalidValue

HotelId = NewType("HotelId", str)
PlaceId = NewType("PlaceId", str)
RoomId = NewType("RoomId", str)
BuildingId = NewType("BuildingId", str)
FactId = NewType("FactId", str)
FacadeId = NewType("FacadeId", str)
GeoFeatureId = NewType("GeoFeatureId", str)
QuestionId = NewType("QuestionId", str)
ConflictId = NewType("ConflictId", str)


class SubjectKind(StrEnum):
    HOTEL = "hotel"
    PLACE = "place"
    ROOM = "room"
    FACADE = "facade"


class EvidenceKind(StrEnum):
    TAG = "tag"
    QUOTE = "quote"
    PARAM = "param"
    DATASET = "dataset"


@dataclass(frozen=True, slots=True)
class LonLat:
    lon: float
    lat: float

    def __post_init__(self) -> None:
        if not -180.0 <= self.lon <= 180.0:
            raise InvalidValue(f"Longitude {self.lon} is outside [-180, 180]")
        if not -90.0 <= self.lat <= 90.0:
            raise InvalidValue(f"Latitude {self.lat} is outside [-90, 90]")

    def as_pair(self) -> tuple[float, float]:
        return (self.lon, self.lat)


@dataclass(frozen=True, slots=True)
class BBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def __post_init__(self) -> None:
        if self.min_lon > self.max_lon or self.min_lat > self.max_lat:
            raise InvalidValue("Bounding box corners are swapped")

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.min_lon, self.min_lat, self.max_lon, self.max_lat)


@dataclass(frozen=True, slots=True)
class Azimuth:
    degrees: float

    def __post_init__(self) -> None:
        if not 0.0 <= self.degrees < 360.0:
            raise InvalidValue(f"Azimuth {self.degrees} is outside [0, 360)")

    def opposite(self) -> "Azimuth":
        return Azimuth((self.degrees + 180.0) % 360.0)


@dataclass(frozen=True, slots=True)
class Subject:
    kind: SubjectKind
    owner: str
    part: str | None = None

    def __post_init__(self) -> None:
        if not self.owner:
            raise InvalidValue("Subject owner is empty")
        if (self.kind is SubjectKind.FACADE) != (self.part is not None):
            raise InvalidValue(f"Subject kind {self.kind} does not take part {self.part!r}")

    @classmethod
    def hotel(cls, hotel_id: HotelId) -> Self:
        return cls(kind=SubjectKind.HOTEL, owner=hotel_id)

    @classmethod
    def place(cls, place_id: PlaceId) -> Self:
        return cls(kind=SubjectKind.PLACE, owner=place_id)

    @classmethod
    def room(cls, room_id: RoomId) -> Self:
        return cls(kind=SubjectKind.ROOM, owner=room_id)

    @classmethod
    def facade(cls, hotel_id: HotelId, azimuth: Azimuth) -> Self:
        return cls(kind=SubjectKind.FACADE, owner=hotel_id, part=_azimuth_part(azimuth))

    @classmethod
    def parse(cls, raw: str) -> Self:
        parts = raw.split(":")
        try:
            kind = SubjectKind(parts[0])
        except ValueError:
            raise InvalidValue(f"Subject {raw!r} has an unknown kind") from None
        if kind is SubjectKind.FACADE:
            if len(parts) != 3:
                raise InvalidValue(f"Subject {raw!r} must read facade:<hotel_id>:<azimuth>")
            return cls(kind=kind, owner=parts[1], part=parts[2])
        if len(parts) != 2:
            raise InvalidValue(f"Subject {raw!r} must read {kind}:<id>")
        return cls(kind=kind, owner=parts[1])

    def __str__(self) -> str:
        tail = f":{self.part}" if self.part is not None else ""
        return f"{self.kind}:{self.owner}{tail}"


@dataclass(frozen=True, slots=True)
class Confidence:
    value: float

    def __post_init__(self) -> None:
        if not 0.0 <= self.value <= 1.0:
            raise InvalidValue(f"Confidence {self.value} is outside [0, 1]")

    def scaled(self, factor: float) -> "Confidence":
        return Confidence(max(0.0, min(1.0, self.value * factor)))


@dataclass(frozen=True, slots=True)
class Ttl:
    days: int

    def __post_init__(self) -> None:
        if self.days <= 0:
            raise InvalidValue(f"TTL {self.days} must be positive")

    def until(self, start: datetime) -> datetime:
        return start + timedelta(days=self.days)


@dataclass(frozen=True, slots=True, kw_only=True)
class SourceRef:
    source_type: SourceType
    ref: str | None = None
    url: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Evidence:
    kind: EvidenceKind
    text: str


@dataclass(frozen=True, slots=True, kw_only=True)
class Provenance:
    source: SourceRef
    method: str
    confidence: Confidence
    computed_at: datetime
    observed_at: datetime | None = None
    valid_until: datetime | None = None
    evidence: tuple[Evidence, ...] = ()

    def __post_init__(self) -> None:
        if not self.method:
            raise InvalidValue("Provenance method is empty")
        if self.valid_until is not None and self.valid_until <= self.computed_at:
            raise InvalidValue("Provenance valid_until is not after computed_at")

    @property
    def source_type(self) -> SourceType:
        return self.source.source_type

    def is_expired_at(self, now: datetime) -> bool:
        return self.valid_until is not None and now >= self.valid_until


@dataclass(frozen=True, slots=True, kw_only=True)
class Camera:
    center: LonLat
    zoom: float
    pitch: float
    bearing: float
    duration_ms: int | None = None
    target_alt_m: float | None = None
    range_m: float | None = None
    focus_facade_id: FacadeId | None = None

    def __post_init__(self) -> None:
        if not 0.0 <= self.pitch <= 85.0:
            raise InvalidValue(f"Camera pitch {self.pitch} is outside [0, 85]")
        if not 0.0 <= self.bearing < 360.0:
            raise InvalidValue(f"Camera bearing {self.bearing} is outside [0, 360)")


def facade_id(hotel_id: HotelId, azimuth: Azimuth) -> FacadeId:
    return FacadeId(f"fc_{hotel_id}_{_azimuth_part(azimuth)}")


def _azimuth_part(azimuth: Azimuth) -> str:
    return str(round(azimuth.degrees) % 360)
