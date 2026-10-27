from typing import Any
from urllib.parse import urlsplit

from hotel_agent.application.ports.supplier_details import (
    SupplierAmenity,
    SupplierAmenityGroup,
    SupplierDetails,
    SupplierHotel,
    SupplierHotelFacts,
    SupplierPhoto,
    SupplierRating,
)
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity, assess_identity

PAGE_LIMIT = 3
AMENITY_LIMIT = 40
PHOTO_LIMIT = 8


class WebHotelCard:
    def __init__(self, research: WebResearchPort, page_limit: int = PAGE_LIMIT) -> None:
        self._research = research
        self._page_limit = page_limit

    async def find(self, hotel: HotelIdentity) -> SupplierHotel | None:
        try:
            hits = await self._research.search(query(hotel))
        except ValueError:
            return None
        for hit in hits[: self._page_limit]:
            try:
                page = await self._research.read(hit.url)
            except ValueError:
                continue
            found = self._card(hotel, page)
            if found is not None:
                return found
        return None

    def _card(self, hotel: HotelIdentity, page: WebPage) -> SupplierHotel | None:
        for record in page.hotels:
            details = card_details(record, page.url)
            if details is None or details.location is None:
                continue
            candidate = HotelCandidate(
                supplier_id=details.supplier_id,
                identity=HotelIdentity(
                    name=details.name,
                    address=details.address,
                    location=details.location,
                    city=details.city,
                ),
            )
            if assess_identity(hotel, candidate).accepted:
                return SupplierHotel(details=details)
        return None


def query(hotel: HotelIdentity) -> str:
    parts = [f'"{hotel.name}"']
    if hotel.city:
        parts.append(hotel.city)
    if hotel.address:
        parts.append(hotel.address)
    parts.append("отель официальный сайт номера")
    return " ".join(parts)[:500]


def card_details(record: dict[str, Any], url: str) -> SupplierDetails | None:
    name = _text(record.get("name"))
    location = _location(record.get("geo"))
    if not name or location is None:
        return None
    street, city = _address(record.get("address"))
    rating = _rating(record.get("aggregateRating"))
    amenities = _amenities(record.get("amenityFeature"))
    return SupplierDetails(
        supplier_id=urlsplit(url).netloc,
        page_url=url,
        name=name,
        address=street,
        city=city,
        location=location,
        photos=_photos(record.get("image")),
        facts=SupplierHotelFacts(
            rooms_number=_count(record.get("numberOfRooms")),
            star_rating=_count(_value(record.get("starRating"))),
        ),
        amenity_groups=(
            (SupplierAmenityGroup(name="Удобства", amenities=amenities),) if amenities else ()
        ),
        rating=rating,
        check_in_from=_text(record.get("checkinTime")),
        check_out_until=_text(record.get("checkoutTime")),
        email=_text(record.get("email")),
        phone=_text(record.get("telephone")),
    )


def _text(value: object) -> str | None:
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, str)), None)
    if not isinstance(value, str):
        return None
    found = " ".join(value.split())
    return found[:300] or None


def _value(value: object) -> object:
    return value.get("ratingValue") if isinstance(value, dict) else value


def _count(value: object) -> int | None:
    value = _value(value)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 < value <= 10_000 else None
    if isinstance(value, str) and value.strip().isdigit():
        number = int(value.strip())
        return number if 0 < number <= 10_000 else None
    return None


def _location(value: object) -> tuple[float, float] | None:
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, dict)), None)
    if not isinstance(value, dict):
        return None
    latitude, longitude = _number(value.get("latitude")), _number(value.get("longitude"))
    if latitude is None or longitude is None:
        return None
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None
    return longitude, latitude


def _number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def _address(value: object) -> tuple[str | None, str | None]:
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, dict | str)), None)
    if isinstance(value, str):
        return _text(value), None
    if not isinstance(value, dict):
        return None, None
    return _text(value.get("streetAddress")), _text(value.get("addressLocality"))


def _rating(value: object) -> SupplierRating | None:
    if not isinstance(value, dict):
        return None
    total = _number(value.get("ratingValue"))
    reviews = _count(value.get("reviewCount") or value.get("ratingCount"))
    if total is None and reviews is None:
        return None
    return SupplierRating(total=total, reviews_count=reviews)


def _amenities(value: object, depth: int = 0) -> tuple[SupplierAmenity, ...]:
    if depth > AMENITY_LIMIT:
        return ()
    rows = value if isinstance(value, list) else [value]
    found: list[SupplierAmenity] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("value") not in (False, "False", "false", "0"):
            name = _text(row.get("name"))
            if name:
                found.append(SupplierAmenity(name=name))
        if "amenityFeature" in row:
            found.extend(_amenities(row["amenityFeature"], depth + 1))
    return tuple(found[:AMENITY_LIMIT])


def _photos(value: object) -> tuple[SupplierPhoto, ...]:
    rows = value if isinstance(value, list) else [value]
    found = []
    for row in rows:
        url = _text(row.get("url")) if isinstance(row, dict) else _text(row)
        if url and url.startswith(("http://", "https://")):
            found.append(SupplierPhoto(url=url))
    return tuple(found[:PHOTO_LIMIT])
