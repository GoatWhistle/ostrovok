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
    name = (optional_text(raw, "name") or "").strip()
    return NearbyObjectRequest(
        osm_key=key,
        osm_value=value,
        open_24h=flag(raw, "open_24h"),
        avoid=flag(raw, "avoid"),
        required=flag(raw, "required"),
        radius_m=max(100, min(50000, int(radius or 500))),
        source_text=source,
        name=name if quoted_name(name, query) else "",
    )


def quoted_name(name: str, query: str) -> bool:
    asked = normalize(query)
    words = [word for word in normalize(name).split() if len(word) >= 3]
    return bool(words) and all(word[: max(4, len(word) - 2)] in asked for word in words)


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
        100000 if kind in {"landmark_view", "sea_view"} else 1500 if kind == "city_center" else 500
    )
    radius = int(number(raw, "radius_m") or default)
    return SpatialRequest(
        kind=kind,
        target=target.strip() if target else None,
        radius_m=max(100, min(200000 if kind in {"landmark_view", "sea_view"} else 50000, radius)),
        source_text=source,
        required=flag(raw, "required"),
        floor_min=_floor(raw.get("floor_min")),
        floor_max=_floor(raw.get("floor_max")),
        facade_azimuth_deg=_azimuth(raw.get("facade_azimuth_deg")),
        target_osm_key=optional_text(raw, "target_osm_key"),
        target_osm_values=tuple(strings(raw, "target_osm_values")),
        target_component_key=optional_text(raw, "target_component_key"),
        target_component_values=tuple(strings(raw, "target_component_values")),
        target_part=str(raw.get("target_part"))
        if raw.get("target_part") in {"top", "whole"}
        else "any",
    )


def _azimuth(value: object) -> float | None:
    if isinstance(value, int | float) and not isinstance(value, bool) and 0 <= value < 360:
        return float(value)
    return None


def _floor(value: object) -> int | None:
    return (
        value
        if isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 200
        else None
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
    location_source = optional_text(payload, "location_source_text")
    location_fragment = (
        normalize(location_source)
        if location_source
        and optional_text(payload, "location_hint")
        and normalize(location_source) in normalize(query)
        else None
    )
    return ParsedQuery(
        wishes=tuple(
            item.strip()
            for item in strings(payload, "wishes")
            if item.strip()
            and normalize(item) in normalize(query)
            and normalize(item) != location_fragment
        ),
        intents=intents,
        unmatched_terms=tuple(
            item
            for item in dict.fromkeys((*strings(payload, "unmatched_terms"), *unit_terms))
            if normalize(item) != location_fragment
        ),
        location_hint=optional_text(payload, "location_hint"),
        anywhere=flag(payload, "anywhere"),
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
        room_preferences_unrestricted=flag(payload, "room_preferences_unrestricted"),
        budget=optional_text(payload, "budget"),
        check_in=parse_date(payload.get("check_in")),
        check_out=parse_date(payload.get("check_out")),
        adults=adults(payload.get("adults")),
    )
