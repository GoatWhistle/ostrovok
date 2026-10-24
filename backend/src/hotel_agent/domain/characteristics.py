from dataclasses import dataclass
from enum import StrEnum


class ValueType(StrEnum):
    BOOL = "bool"
    NUMBER = "number"
    ENUM = "enum"
    TEXT = "text"
    OBJECT = "object"


class Scope(StrEnum):
    HOTEL = "hotel"
    ROOM = "room"
    FACADE = "facade"


class SourceType(StrEnum):
    OSM = "osm"
    DEM = "dem"
    COMPUTED = "computed"
    OPEN_METEO = "open_meteo"
    HOTELIER = "hotelier"
    LLM_EXTRACTION = "llm_extraction"


class GeoStyle(StrEnum):
    LINE = "line"
    POINTS = "points"
    POLYGON = "polygon"
    VIEWSHED = "viewshed"
    FACADE = "facade"


class Op(StrEnum):
    EQ = "eq"
    LTE = "lte"
    GTE = "gte"
    EXISTS = "exists"
    NEAR = "near"


type ScalarValue = bool | float | str | None


@dataclass(frozen=True, slots=True, kw_only=True)
class Display:
    icon: str
    color: str
    geo_style: GeoStyle


@dataclass(frozen=True, slots=True, kw_only=True)
class Matcher:
    phrase: str
    op: Op
    value: ScalarValue
    weight: float
    required: bool


class FieldKind(StrEnum):
    BOOL = "bool"
    NUMBER = "number"


@dataclass(frozen=True, slots=True, kw_only=True)
class FieldRule:
    name: str
    kind: FieldKind
    units: tuple[str, ...]
    positive: tuple[str, ...]
    negative: tuple[str, ...]


@dataclass(frozen=True, slots=True, kw_only=True)
class Characteristic:
    key: str
    title_ru: str
    description: str
    value_type: ValueType
    unit: str | None
    scope: Scope
    synonyms: tuple[str, ...]
    matchers: tuple[Matcher, ...]
    fields: tuple[FieldRule, ...]
    tool: str | None
    ttl_days: int
    precompute: bool
    ask_hotelier_if_missing: bool
    question_template: str | None
    source_kinds: tuple[SourceType, ...]
    display: Display
