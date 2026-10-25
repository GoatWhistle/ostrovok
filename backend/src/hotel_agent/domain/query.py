from dataclasses import dataclass
from datetime import date

from hotel_agent.domain.characteristics import Op, ScalarValue

OSM_OBJECT_KEYS = (
    "amenity",
    "shop",
    "leisure",
    "tourism",
    "historic",
    "natural",
    "healthcare",
    "office",
    "craft",
    "man_made",
    "emergency",
    "public_transport",
    "railway",
    "aeroway",
    "sport",
)


@dataclass(frozen=True, slots=True, kw_only=True)
class Intent:
    characteristic_key: str
    op: Op
    value: ScalarValue
    weight: float
    required: bool
    source_text: str


@dataclass(frozen=True, slots=True, kw_only=True)
class NearbyObjectRequest:
    osm_key: str
    osm_value: str
    open_24h: bool
    radius_m: int
    source_text: str
    avoid: bool = False
    required: bool = False


@dataclass(frozen=True, slots=True, kw_only=True)
class FacilityRequest:
    term: str
    source_text: str
    required: bool = False


@dataclass(frozen=True, slots=True, kw_only=True)
class SpatialRequest:
    kind: str
    target: str | None
    radius_m: int
    source_text: str
    required: bool = False


@dataclass(frozen=True, slots=True, kw_only=True)
class QueryCorrection:
    original: str
    corrected: str
    reason: str


@dataclass(frozen=True, slots=True, kw_only=True)
class ParsedQuery:
    intents: tuple[Intent, ...]
    unmatched_terms: tuple[str, ...]
    location_hint: str | None
    anywhere: bool = False
    nearby_objects: tuple[NearbyObjectRequest, ...] = ()
    facility_requests: tuple[FacilityRequest, ...] = ()
    spatial_requests: tuple[SpatialRequest, ...] = ()
    normalized_query: str | None = None
    corrections: tuple[QueryCorrection, ...] = ()
    unsupported_region: str | None = None
    needs_clarification: bool = False
    wants_room: bool = False
    check_in: date | None = None
    check_out: date | None = None
    adults: int | None = None
