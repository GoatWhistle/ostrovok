from collections.abc import Iterable, Mapping, Sequence
from datetime import date

from hotel_agent.application.anywhere_request import ANYWHERE_MARK
from hotel_agent.domain.filters import SearchFilter
from hotel_agent.domain.query import ParsedQuery


def filters_of(parsed: ParsedQuery) -> tuple[SearchFilter, ...]:
    location = parsed.location_hint.strip() if parsed.location_hint else ""
    return _stay(location, parsed.check_in, parsed.check_out, parsed.adults) + _wishes(
        (intent.source_text, intent.characteristic_key) for intent in parsed.intents
    )


def filters_of_snapshot(snapshot: Mapping[str, object] | None) -> tuple[SearchFilter, ...]:
    parsed = snapshot.get("parsed") if snapshot is not None else None
    if not isinstance(parsed, Mapping):
        return ()
    location = parsed.get("location_hint")
    adults = parsed.get("adults")
    stay = _stay(
        str(location).strip() if isinstance(location, str) else "",
        _day(parsed.get("check_in")),
        _day(parsed.get("check_out")),
        adults if isinstance(adults, int) else None,
    )
    intents = parsed.get("intents")
    if not isinstance(intents, list):
        return stay
    return stay + _wishes(
        (str(item.get("source_text", "")), str(item.get("characteristic_key", "")))
        for item in intents
        if isinstance(item, Mapping)
    )


def query_of(filters: Sequence[SearchFilter]) -> str:
    parts = [text for item in filters if (text := _part(item))]
    if parts and not any(item.kind == "location" for item in filters):
        parts.append(ANYWHERE_MARK)
    return "; ".join(parts)


def _stay(
    location: str, check_in: date | None, check_out: date | None, adults: int | None
) -> tuple[SearchFilter, ...]:
    found: list[SearchFilter] = []
    if location:
        found.append(SearchFilter(kind="location", label=location))
    if check_in is not None:
        found.append(SearchFilter(kind="dates", check_in=check_in, check_out=check_out))
    if adults:
        found.append(SearchFilter(kind="guests", adults=adults))
    return tuple(found)


def _wishes(terms: Iterable[tuple[str, str]]) -> tuple[SearchFilter, ...]:
    found: list[SearchFilter] = []
    seen: set[str] = set()
    for source_text, key in terms:
        label = source_text.strip()
        marker = label.casefold()
        if not label or marker in seen:
            continue
        seen.add(marker)
        found.append(SearchFilter(kind="wish", label=label, key=key or None))
    return tuple(found)


def _part(item: SearchFilter) -> str:
    if item.kind == "dates":
        if item.check_in is None:
            return ""
        if item.check_out is None:
            return f"заезд {item.check_in.isoformat()}"
        return f"заезд {item.check_in.isoformat()}, выезд {item.check_out.isoformat()}"
    if item.kind == "guests":
        return f"взрослых: {item.adults}" if item.adults else ""
    return item.label.strip()


def _day(value: object) -> date | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None
