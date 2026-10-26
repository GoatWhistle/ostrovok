from datetime import UTC, datetime
from math import isfinite
from typing import Any
from urllib.parse import urljoin, urlsplit

EVENT_TYPES = frozenset(
    {
        "Event",
        "MusicEvent",
        "TheaterEvent",
        "Festival",
        "ExhibitionEvent",
        "SportsEvent",
        "DanceEvent",
        "ComedyEvent",
        "EducationEvent",
        "ChildrensEvent",
        "FoodEvent",
        "LiteraryEvent",
        "ScreeningEvent",
        "SocialEvent",
        "BusinessEvent",
        "VisualArtsEvent",
    }
)
EVENT_FIELDS = frozenset(
    {
        "@type",
        "name",
        "description",
        "startDate",
        "endDate",
        "eventStatus",
        "eventAttendanceMode",
        "location",
        "url",
        "isAccessibleForFree",
        "previousStartDate",
    }
)


def timestamp(value: object) -> datetime | None:
    try:
        if isinstance(value, int | float) and not isinstance(value, bool) and value > 0:
            return datetime.fromtimestamp(value, UTC)
        if isinstance(value, str) and "T" in value:
            parsed = datetime.fromisoformat(value)
            return parsed if parsed.utcoffset() is not None else None
    except (ValueError, OverflowError, OSError):
        pass
    return None


def event_record(raw: dict[str, Any], source: str, schema: bool = False) -> dict[str, Any] | None:
    place = raw.get("location" if schema else "place")
    if not isinstance(place, dict) or place.get("is_closed") is True:
        return None
    statuses = _enums(raw.get("eventStatus")) or {"unknown"}
    attendance = _enums(raw.get("eventAttendanceMode"))
    if statuses & {"EventCancelled", "EventPostponed", "EventMovedOnline"}:
        return None
    if "OnlineEventAttendanceMode" in attendance and not attendance & {
        "OfflineEventAttendanceMode",
        "MixedEventAttendanceMode",
    }:
        return None
    status = ", ".join(sorted(statuses))
    geo = place.get("geo" if schema else "coords")
    if not isinstance(geo, dict):
        return None
    try:
        lon = float(geo["longitude" if schema else "lon"])
        lat = float(geo["latitude" if schema else "lat"])
    except (KeyError, ValueError, TypeError):
        return None
    if not isfinite(lon) or not isfinite(lat) or not -180 <= lon <= 180 or not -90 <= lat <= 90:
        return None
    url = urljoin(source, str(raw.get("url" if schema else "site_url") or source))
    if urlsplit(url).scheme not in {"http", "https"} or urlsplit(url).username:
        return None
    return {
        "title": str(raw.get("name" if schema else "title") or "")[:300],
        "description": str(raw.get("description") or "")[:1600],
        "source_url": url,
        "place": str(place.get("name" if schema else "title") or "")[:300],
        "location": (lon, lat),
        "status": status,
        "is_free": raw.get("isAccessibleForFree" if schema else "is_free"),
    }


def _enums(value: object) -> set[str]:
    values = value if isinstance(value, list) else [value]
    return {v.rsplit("/", 1)[-1] for v in values if isinstance(v, str)}
