import json
from dataclasses import asdict
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.supplier_details import SupplierDetails, SupplierHotel

DESCRIPTION_LIMIT = 4000


def identity(hotel: SearchHotelRecord, details: SupplierDetails, source: str) -> dict[str, Any]:
    return {
        "hotel_id": hotel.id,
        "hotel_name": hotel.name,
        "hotel_address": hotel.address,
        "hotel_location": hotel.location,
        "source_url": details.page_url,
        "source": source,
    }


def hotel_record(hotel: SearchHotelRecord, found: SupplierHotel, source: str) -> dict[str, Any]:
    details = found.details
    facts = details.facts
    registry = facts.registry
    payload: dict[str, Any] = {
        "name": details.name,
        "address": details.address,
        "city": details.city,
        "facts": {key: value for key, value in asdict(facts).items() if value is not None},
        "amenities": {
            group.name: [
                f"{item.name} (бесплатно)" if item.free else item.name for item in group.amenities
            ]
            for group in details.amenity_groups
        },
        "nearby_m": {place.name: place.distance_m for place in details.nearby},
        "room_categories": [room.name for room in found.rooms],
        "photo_count": len(details.photos),
        "check_in_from": details.check_in_from,
        "check_out_until": details.check_out_until,
    }
    if registry is not None:
        payload["facts"]["registry"] = {
            "record": registry.record,
            "link": registry.link,
            "rooms_by_category": {item.category: item.rooms for item in registry.categories},
        }
    if details.rating is not None:
        payload["rating"] = {
            "total_of_10": details.rating.total,
            "reviews": details.rating.reviews_count,
            "detailed": {score.name: score.score for score in details.rating.detailed},
        }
    text = "\n".join(
        f"{section.title}: {' '.join(section.paragraphs)}" for section in details.description
    )
    if text:
        payload["description"] = text[:DESCRIPTION_LIMIT]
    return {
        **identity(hotel, details, source),
        "id": details.supplier_id,
        "text": json.dumps(payload, ensure_ascii=False),
    }


def room_records(
    hotel: SearchHotelRecord, found: SupplierHotel, source: str
) -> list[dict[str, Any]]:
    base = identity(hotel, found.details, source)
    records = []
    for room in found.rooms:
        payload = {
            "name": room.name,
            "bedding": room.bedding,
            "size_sqm": room.size_sqm,
            "amenities": list(room.amenities),
            "photo_count": len(room.photos),
        }
        records.append(
            {
                **base,
                "id": room.id,
                "name": room.name,
                "amenities": list(room.amenities),
                "size_sqm": room.size_sqm,
                "bedding": room.bedding,
                "photos": list(room.photos),
                "text": json.dumps(payload, ensure_ascii=False),
            }
        )
    return records
