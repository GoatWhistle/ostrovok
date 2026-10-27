import json
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_catalog import CatalogHotel

HOTEL_URL = "https://api.liteapi.travel/v3.0/data/hotel?hotelId="


def identity(hotel: SearchHotelRecord, supplier_id: str) -> dict[str, Any]:
    return {
        "hotel_id": hotel.id,
        "hotel_name": hotel.name,
        "hotel_address": hotel.address,
        "hotel_location": hotel.location,
        "source_url": HOTEL_URL + supplier_id,
        "source": "Nuitee",
    }


def hotel_record(
    hotel: SearchHotelRecord, catalog: CatalogHotel, supplier_id: str
) -> dict[str, Any]:
    return {
        **identity(hotel, supplier_id),
        "id": supplier_id,
        "text": json.dumps(
            {
                "name": catalog.name,
                "facilities_ru": catalog.facilities_ru,
                "facilities_en": catalog.facilities_en,
                "details": catalog.details,
            },
            ensure_ascii=False,
        ),
    }


def room_records(
    hotel: SearchHotelRecord, catalog: CatalogHotel, supplier_id: str
) -> list[dict[str, Any]]:
    base = identity(hotel, supplier_id)
    return [
        {
            **base,
            "id": room.supplier_id,
            "name": room.name,
            "capacity": room.max_adults,
            "amenities": list(room.amenities),
            "details": room.details,
            "text": json.dumps(
                {
                    "name": room.name,
                    "capacity": room.max_adults,
                    "amenities": room.amenities,
                    "details": room.details,
                },
                ensure_ascii=False,
            ),
        }
        for room in catalog.rooms
    ]
