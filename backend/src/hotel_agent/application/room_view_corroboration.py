from collections.abc import Mapping, Sequence
from dataclasses import replace
from typing import Any

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.room_records import RoomRecord

VIEW_CODES_BY_KIND: dict[str, tuple[str, ...]] = {
    "sea_view": ("sea",),
    "sunset_view": ("sunset", "panoramic"),
    "sunrise_view": ("sunrise", "panoramic"),
}


def corroborate_room_views(
    facts: Sequence[SearchFactRecord], rooms: Mapping[str, Sequence[RoomRecord]]
) -> tuple[SearchFactRecord, ...]:
    return tuple(_fact(fact, rooms.get(fact.hotel_id, ())) for fact in facts)


def _fact(fact: SearchFactRecord, rooms: Sequence[RoomRecord]) -> SearchFactRecord:
    visibility = fact.qualifiers.get("visibility")
    if not rooms or not isinstance(visibility, dict):
        return fact
    codes = _codes(fact, visibility)
    if not codes:
        return fact
    room = _match(rooms, codes, visibility.get("floor"))
    if room is None:
        return fact
    confirmed = visibility.get("status") == "visible"
    declared: dict[str, Any] = {
        "category": room.name,
        "views": list(room.views),
        "floor": room.floor_min,
        "capacity": room.capacity,
        "source": room.declared_source,
        "page_url": room.page_url,
    }
    qualifiers = {
        **fact.qualifiers,
        "visibility": {
            **visibility,
            "bookable_room_confirmed": confirmed,
            "declared_room": declared,
        },
    }
    return replace(fact, qualifiers=qualifiers, explanation=_explanation(fact, room, confirmed))


def _codes(fact: SearchFactRecord, visibility: dict[str, Any]) -> tuple[str, ...]:
    kind = visibility.get("request_kind")
    if isinstance(kind, str) and kind in VIEW_CODES_BY_KIND:
        return VIEW_CODES_BY_KIND[kind]
    return VIEW_CODES_BY_KIND.get(fact.characteristic_key, ())


def _match(rooms: Sequence[RoomRecord], codes: tuple[str, ...], floor: object) -> RoomRecord | None:
    computed = floor if isinstance(floor, int) and not isinstance(floor, bool) else None
    found: RoomRecord | None = None
    for room in rooms:
        if not any(code in room.views for code in codes):
            continue
        if computed is not None and room.floor_min is not None and room.floor_min >= computed:
            return room
        found = found or room
    return found


def _explanation(fact: SearchFactRecord, room: RoomRecord, confirmed: bool) -> str:
    floor = f", этаж {room.floor_min}" if room.floor_min is not None else ""
    source = f" по карточке {room.declared_source}" if room.declared_source else ""
    lead = (
        "Поставщик заявляет категорию с таким видом"
        if confirmed
        else "Категория с таким видом у поставщика есть, но расчёт вид не подтвердил"
    )
    return (
        f"{fact.explanation} {lead}: «{room.name}»{floor}{source}. "
        "Это заявление о категории, а не проверенный нами номер."
    )
