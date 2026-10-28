import hashlib
import json
import re
from html import unescape
from typing import Any

from hotel_agent.application.ports.supplier_details import (
    SupplierDetails,
    SupplierHotelFacts,
    SupplierPhoto,
    SupplierRoom,
)
from hotel_agent.domain.room_views import declared_views, named_views

ROOM_LIMIT = 40
AMENITY_LIMIT = 40
AMENITY_LABELS = ("Мебель", "Оборудование", "Санузел", "Сервис", "Балкон")
REQUIRED_LABELS = ("Площадь (кв. м)", "Кол-во основных мест")
LD_JSON = re.compile(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.DOTALL)
ROOMS_TAB = re.compile(r'<div class="js-tabContent" id="rooms"')
NEXT_TAB = re.compile(r'<div class="js-tabContent" id="')
SECTION = re.compile(r'<div class="productSection"')
TITLE = re.compile(r"<h3>(.*?)</h3>", re.DOTALL)
FIELD = re.compile(
    r'productTwoColsList-firstCol">\s*(.*?)\s*</td>'
    r'\s*<td[^>]*productTwoColsList-lastCol">(.*?)</td>',
    re.DOTALL,
)
FLOOR_IN_NAME = re.compile(r"(\d{1,2})\s*этаж")
TAGS = re.compile(r"<[^>]+>")


def card_details(html: str, page_url: str) -> SupplierDetails | None:
    record = _hotel_record(html)
    if record is None:
        return None
    name = _text(record.get("name"))
    if name is None:
        return None
    address = _mapping(record.get("address"))
    geo = _mapping(record.get("geo"))
    image = _text(record.get("image"))
    return SupplierDetails(
        supplier_id=page_url,
        page_url=page_url,
        name=name,
        address=_text(address.get("streetAddress")),
        city=None,
        location=_coordinates(geo.get("longitude"), geo.get("latitude")),
        photos=(SupplierPhoto(url=image),) if image else (),
        facts=SupplierHotelFacts(star_rating=_stars(record.get("starRating"))),
    )


def card_rooms(html: str) -> tuple[SupplierRoom, ...]:
    rooms = []
    for block in _sections(html):
        title = TITLE.search(block)
        name = _plain(title.group(1)) if title else None
        fields = {_plain(label) or "": value for label, value in FIELD.findall(block)}
        if name is None or not any(label in fields for label in REQUIRED_LABELS):
            continue
        declared = _plain(fields.get("Вид из номера", "")) or ""
        rooms.append(
            SupplierRoom(
                id=f"alean:{hashlib.sha256(name.encode()).hexdigest()[:12]}",
                name=name,
                photos=(),
                amenities=_amenities(fields),
                size_sqm=_measure(_plain(fields.get("Площадь (кв. м)", ""))),
                views=declared_views(declared) or named_views(name),
                floor=_floor(_plain(fields.get("Этаж", "")), name),
                main_places=_count(_plain(fields.get("Кол-во основных мест", ""))),
                extra_places=_count(_plain(fields.get("Кол-во доп. мест", ""))),
            )
        )
        if len(rooms) == ROOM_LIMIT:
            break
    return tuple({room.id: room for room in rooms}.values())


def _sections(html: str) -> list[str]:
    tab = ROOMS_TAB.split(html, maxsplit=1)
    if len(tab) < 2:
        return []
    return SECTION.split(NEXT_TAB.split(tab[1], maxsplit=1)[0])[1:]


def _amenities(fields: dict[str, str]) -> tuple[str, ...]:
    found: dict[str, None] = {}
    for label in AMENITY_LABELS:
        for part in fields.get(label, "").split("</div>"):
            item = _plain(part)
            if item is not None:
                found.setdefault(item, None)
    return tuple(found)[:AMENITY_LIMIT]


def _hotel_record(html: str) -> dict[str, Any] | None:
    for raw in LD_JSON.findall(html):
        try:
            record = json.loads(unescape(raw).strip())
        except ValueError:
            continue
        if isinstance(record, dict) and record.get("@type") == "Hotel":
            return record
    return None


def _floor(value: str | None, name: str) -> int | None:
    found = _count(value)
    if found is not None:
        return found
    match = FLOOR_IN_NAME.search(name.casefold())
    return _count(match.group(1)) if match else None


def _plain(value: str) -> str | None:
    text = TAGS.sub(" ", unescape(value))
    return re.sub(r"\s+", " ", text).strip() or None


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _count(value: object) -> int | None:
    text = _text(value)
    if text is None or not text.isdigit():
        return None
    found = int(text)
    return found if 0 < found <= 100 else None


def _measure(value: object) -> float | None:
    text = _text(value)
    if text is None:
        return None
    match = re.match(r"\d+(?:[.,]\d+)?", text)
    if match is None:
        return None
    found = float(match.group(0).replace(",", "."))
    return found if 1 <= found <= 2000 else None


def _stars(value: object) -> int | None:
    rating = _mapping(value).get("ratingValue")
    if isinstance(rating, bool) or not isinstance(rating, (int, float)):
        return None
    return int(rating) if 1 <= rating <= 5 else None


def _mapping(value: object) -> dict[str, Any]:
    return {str(key): item for key, item in value.items()} if isinstance(value, dict) else {}


def _coordinates(lon: object, lat: object) -> tuple[float, float] | None:
    if isinstance(lon, bool) or isinstance(lat, bool):
        return None
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return None
    if not -180 <= lon <= 180 or not -90 <= lat <= 90:
        return None
    return float(lon), float(lat)
