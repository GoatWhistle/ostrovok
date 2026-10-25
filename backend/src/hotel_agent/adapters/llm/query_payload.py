from collections.abc import Callable, Mapping, Sequence
from datetime import date

from hotel_agent.adapters.llm.payload import flag, items, number, optional_text, strings, text
from hotel_agent.adapters.llm.text import normalize
from hotel_agent.domain.characteristics import ValueType
from hotel_agent.domain.query import (
    OSM_OBJECT_KEYS,
    FacilityRequest,
    Intent,
    NearbyObjectRequest,
    ParsedQuery,
    QueryCorrection,
    SpatialRequest,
)


def plan_request(
    query: ParsedQuery, subjects: Sequence[str], known: Mapping[str, Sequence[str]]
) -> str:
    wanted = ", ".join(intent.characteristic_key for intent in query.intents) or "нет"
    lines = [f"{subject}: {', '.join(known.get(subject, ())) or 'ничего'}" for subject in subjects]
    return f"Нужны характеристики: {wanted}\nУже известно по объектам:\n" + "\n".join(lines)


def valid_intent_value(value_type: ValueType, value: object) -> bool:
    if value_type == ValueType.NUMBER:
        return isinstance(value, int | float) and not isinstance(value, bool)
    if value_type == ValueType.BOOL:
        return isinstance(value, bool)
    if value_type in {ValueType.ENUM, ValueType.TEXT}:
        return isinstance(value, str)
    return isinstance(value, bool | str | int | float)


def nearby_object(raw: Mapping[str, object], query: str) -> NearbyObjectRequest | None:
    key = text(raw, "osm_key")
    value = text(raw, "osm_value").strip().lower()
    source = text(raw, "source_text").strip()
    if (
        key not in OSM_OBJECT_KEYS
        or not value
        or not source
        or normalize(source) not in normalize(query)
    ):
        return None
    radius = number(raw, "radius_m")
    return NearbyObjectRequest(
        osm_key=key,
        osm_value=value,
        open_24h=flag(raw, "open_24h"),
        avoid=flag(raw, "avoid"),
        required=flag(raw, "required"),
        radius_m=max(100, min(50000, int(radius or 500))),
        source_text=source,
    )


def query_correction(raw: Mapping[str, object], query: str) -> QueryCorrection | None:
    original = text(raw, "original").strip()
    corrected = text(raw, "corrected").strip()
    reason = text(raw, "reason").strip()
    if not original or normalize(original) not in normalize(query) or not corrected or not reason:
        return None
    return QueryCorrection(original=original, corrected=corrected, reason=reason)


def parse_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def adults(value: object) -> int | None:
    if isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 10:
        return value
    return None


def facility_request(raw: Mapping[str, object], query: str) -> FacilityRequest | None:
    term = optional_text(raw, "term")
    source = optional_text(raw, "source_text")
    if (
        term is None
        or source is None
        or len(term) < 3
        or len(term) > 80
        or normalize(source) not in normalize(query)
    ):
        return None
    return FacilityRequest(
        term=term.strip(), source_text=source.strip(), required=flag(raw, "required")
    )


def spatial_request(raw: Mapping[str, object], query: str) -> SpatialRequest | None:
    kind = text(raw, "kind")
    target = optional_text(raw, "target")
    source = text(raw, "source_text").strip()
    if (
        kind
        not in {
            "city_center",
            "landmark_view",
            "landmark_nearby",
            "landmark_distance_min",
            "sea_view",
        }
        or not source
        or normalize(source) not in normalize(query)
        or (kind not in {"city_center", "sea_view"} and (target is None or len(target.strip()) < 3))
    ):
        return None
    default = (
        1500 if kind in {"city_center", "sea_view"} else 2000 if kind == "landmark_view" else 500
    )
    radius = int(number(raw, "radius_m") or default)
    return SpatialRequest(
        kind=kind,
        target=target.strip() if target else None,
        radius_m=max(100, min(50000, radius)),
        source_text=source,
        required=flag(raw, "required"),
    )


def parse_payload(
    payload: Mapping[str, object],
    query: str,
    parse_intent: Callable[[Mapping[str, object], str], Intent | None],
) -> ParsedQuery:
    valid_raw = []
    unit_terms = []
    for raw in items(payload, "intents"):
        source = text(raw, "source_text")
        wrong_unit = text(raw, "characteristic_key") == "building_height" and any(
            marker in normalize(source) for marker in ("этаж", "над уровнем", "в горах")
        )
        if wrong_unit:
            if source and normalize(source) in normalize(query):
                unit_terms.append(source)
        else:
            valid_raw.append(raw)
    intents = tuple(intent for raw in valid_raw if (intent := parse_intent(raw, query)) is not None)
    return ParsedQuery(
        intents=intents,
        unmatched_terms=tuple(dict.fromkeys((*strings(payload, "unmatched_terms"), *unit_terms))),
        location_hint=optional_text(payload, "location_hint"),
        nearby_objects=tuple(
            nearby_item
            for raw in items(payload, "nearby_objects")
            if (nearby_item := nearby_object(raw, query)) is not None
        ),
        facility_requests=tuple(
            facility_item
            for raw in items(payload, "facility_requests")
            if (facility_item := facility_request(raw, query)) is not None
        ),
        spatial_requests=tuple(
            item
            for raw in items(payload, "spatial_requests")
            if (item := spatial_request(raw, query)) is not None
        ),
        normalized_query=optional_text(payload, "normalized_query") or query,
        corrections=tuple(
            correction
            for raw in items(payload, "corrections")
            if (correction := query_correction(raw, query)) is not None
        ),
        needs_clarification=flag(payload, "needs_clarification"),
        wants_room=flag(payload, "wants_room"),
        check_in=parse_date(payload.get("check_in")),
        check_out=parse_date(payload.get("check_out")),
        adults=adults(payload.get("adults")),
    )
