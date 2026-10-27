import math
from typing import Any
from urllib.parse import urlsplit

from hotel_agent.application.ports.supplier_details import (
    SupplierAmenity,
    SupplierAmenityGroup,
    SupplierDescriptionSection,
    SupplierDetails,
    SupplierHotelFacts,
    SupplierNearbyPlace,
    SupplierPhoto,
    SupplierRating,
    SupplierRatingScore,
    SupplierRegistry,
    SupplierRegistryCategory,
)

PHOTO_LIMIT = 24
NEARBY_LIMIT = 12
REGISTRY_HOSTS = frozenset({"tourism.fsa.gov.ru"})


def details(hotel: dict[str, Any], page_url: str, supplier_id: str) -> SupplierDetails:
    name = hotel.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Missing hotel name")
    location = _mapping(hotel.get("location"))
    contacts = _mapping(hotel.get("contacts"))
    return SupplierDetails(
        supplier_id=supplier_id,
        page_url=page_url,
        name=name.strip(),
        address=_text(location.get("address")),
        city=_text(location.get("city")),
        location=_coordinates(location),
        photos=photos(hotel.get("images")),
        facilities=facilities(hotel.get("serpFilters")),
        facts=facts(hotel.get("facts")),
        amenity_groups=amenity_groups(hotel.get("amenityGroups")),
        description=description(hotel.get("descriptionStruct")),
        nearby=nearby(location.get("pois")),
        rating=rating(hotel.get("rating")),
        check_in_from=_clock(hotel.get("policies"), "checkInTimeStart"),
        check_out_until=_clock(hotel.get("policies"), "checkOutTimeEnd"),
        email=_text(contacts.get("email")),
        phone=_text(contacts.get("phone")),
    )


def photos(values: object) -> tuple[SupplierPhoto, ...]:
    found: dict[str, SupplierPhoto] = {}
    for item in _sequence(values):
        if not isinstance(item, dict):
            continue
        url = item.get("tmpl")
        if not isinstance(url, str):
            continue
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname != "cdn.ostrovok.ru":
            continue
        found.setdefault(
            url,
            SupplierPhoto(
                url=url.replace("{size}", "1024x768"), category=_text(item.get("category"))
            ),
        )
        if len(found) == PHOTO_LIMIT:
            break
    return tuple(found.values())


def facilities(values: object) -> tuple[str, ...]:
    found = (
        code.strip().lower() for code in _sequence(values) if isinstance(code, str) and code.strip()
    )
    return tuple(dict.fromkeys(found))


def facts(values: object) -> SupplierHotelFacts:
    if not isinstance(values, dict):
        return SupplierHotelFacts()
    return SupplierHotelFacts(
        floors_number=_positive(values.get("floorsNumber")),
        rooms_number=_positive(values.get("roomsNumber")),
        star_rating=_count(values.get("starRating")),
        year_built=_positive(values.get("yearBuilt")),
        year_renovated=_positive(values.get("yearRenovated")),
        kind=_text(values.get("kind")),
        hotel_wifi=values.get("hasHotelWifi")
        if isinstance(values.get("hasHotelWifi"), bool)
        else None,
        room_wifi=values.get("hasRoomWifi")
        if isinstance(values.get("hasRoomWifi"), bool)
        else None,
        registry=registry(values.get("register")),
    )


def registry(values: object) -> SupplierRegistry | None:
    if not isinstance(values, dict):
        return None
    record = _text(values.get("record"))
    if record is None:
        return None
    link = _text(values.get("link"))
    if link is not None and urlsplit(link).hostname not in REGISTRY_HOSTS:
        link = None
    categories = []
    for row in _sequence(values.get("rooms")):
        if not isinstance(row, dict):
            continue
        category, rooms = _text(row.get("categoryType")), _count(row.get("roomsCount"))
        if category is not None and rooms is not None:
            categories.append(SupplierRegistryCategory(category=category, rooms=rooms))
    return SupplierRegistry(
        record=record,
        name=_text(values.get("name")),
        address=_text(values.get("address")),
        link=link,
        categories=tuple(categories),
    )


def amenity_groups(values: object) -> tuple[SupplierAmenityGroup, ...]:
    groups = []
    for item in _sequence(values):
        if not isinstance(item, dict):
            continue
        title = _text(item.get("name"))
        amenities = []
        for entry in _sequence(item.get("amenities")):
            if not isinstance(entry, dict):
                continue
            label = _text(entry.get("name"))
            if label is not None:
                amenities.append(SupplierAmenity(name=label, free=bool(entry.get("isFree"))))
        if title is not None and amenities:
            groups.append(SupplierAmenityGroup(name=title, amenities=tuple(amenities)))
    return tuple(groups)


def description(values: object) -> tuple[SupplierDescriptionSection, ...]:
    sections = []
    for item in _sequence(values):
        if not isinstance(item, dict):
            continue
        title = _text(item.get("title"))
        paragraphs = tuple(
            text
            for text in (_text(part) for part in _sequence(item.get("paragraphs")))
            if text is not None
        )
        if title is not None and paragraphs:
            sections.append(SupplierDescriptionSection(title=title, paragraphs=paragraphs))
    return tuple(sections)


def nearby(values: object) -> tuple[SupplierNearbyPlace, ...]:
    places = []
    for item in _sequence(values):
        if not isinstance(item, dict):
            continue
        name, distance = _text(item.get("name")), _count(item.get("distance"))
        if name is None or distance is None:
            continue
        places.append(
            SupplierNearbyPlace(
                name=name, distance_m=distance, kind=_text(item.get("poiSubtypeSlug"))
            )
        )
    return tuple(sorted(places, key=lambda place: place.distance_m)[:NEARBY_LIMIT])


def rating(values: object) -> SupplierRating | None:
    if not isinstance(values, dict):
        return None
    total = _score(values.get("total"))
    reviews = _count(values.get("reviewsCount"))
    own = _mapping(values.get("ostrovok"))
    detailed = _mapping(own.get("detailedRatings"))
    scores = tuple(
        SupplierRatingScore(name=key, score=score)
        for key, raw in sorted(detailed.items())
        if isinstance(key, str) and (score := _score(raw)) is not None
    )
    if total is None and reviews is None and not scores:
        return None
    return SupplierRating(total=total, reviews_count=reviews, detailed=scores)


def _clock(policies: object, key: str) -> str | None:
    if not isinstance(policies, dict):
        return None
    entry = policies.get("checkInCheckOut")
    value = entry.get("value") if isinstance(entry, dict) else None
    moment = value.get(key) if isinstance(value, dict) else None
    if not isinstance(moment, dict):
        return None
    hours, minutes = _count(moment.get("hours")), _count(moment.get("minutes"))
    if hours is None or hours > 23:
        return None
    return f"{hours:02d}:{(minutes or 0):02d}"


def _mapping(value: object) -> dict[str, Any]:
    return {str(key): item for key, item in value.items()} if isinstance(value, dict) else {}


def _sequence(value: object) -> list[Any]:
    return list(value) if isinstance(value, list) else []


def _coordinates(location: dict[str, Any]) -> tuple[float, float] | None:
    lon, lat = location.get("longitude"), location.get("latitude")
    if isinstance(lon, bool) or isinstance(lat, bool):
        return None
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return None
    if not math.isfinite(lon) or not math.isfinite(lat):
        return None
    if not -180 <= lon <= 180 or not -90 <= lat <= 90:
        return None
    return float(lon), float(lat)


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _count(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


def _positive(value: object) -> int | None:
    found = _count(value)
    return found if found else None


def _score(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value) or not 0 <= value <= 10:
        return None
    return round(float(value), 1)
