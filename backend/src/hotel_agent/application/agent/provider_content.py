import json
from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_catalog import CatalogProviderFailure, HotelCatalogSource
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class ProviderContent:
    def __init__(
        self,
        source: HotelCatalogSource | None,
        uow: UnitOfWorkFactory,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
    ) -> None:
        self._source, self._uow, self._hotels = source, uow, hotels
        self.hotels: list[dict[str, Any]] = []
        self.rooms: list[dict[str, Any]] = []
        self._checked: dict[str, str] = {}

    async def read(self, hotel_ids: Sequence[str]) -> dict[str, Any]:
        if self._source is None:
            return {
                "unavailable": True,
                "error": "Provider content is not configured",
                "missing_room_hotel_ids": list(hotel_ids),
            }
        selected = [hotel for hotel in self._hotels() if hotel.id in hotel_ids][:4]
        if not selected:
            raise ValueError("Select 1–4 hotel_ids from the candidates")
        results = []
        for hotel in selected:
            if hotel.id in self._checked:
                results.append(
                    {"hotel_id": hotel.id, "status": self._checked[hotel.id], "cached": True}
                )
                continue
            async with self._uow() as uow:
                supplier_id = await uow.search.get_supplier_id(hotel.id, "nuitee")
            status = "unmapped"
            if supplier_id is not None:
                try:
                    catalog = await self._source.get_hotel(supplier_id)
                except CatalogProviderFailure:
                    status = "unavailable"
                else:
                    status = "available"
                    source_url = "https://api.liteapi.travel/v3.0/data/hotel?hotelId=" + supplier_id
                    identity = {
                        "hotel_id": hotel.id,
                        "hotel_name": hotel.name,
                        "hotel_address": hotel.address,
                        "hotel_location": hotel.location,
                        "source_url": source_url,
                        "source": "Nuitee",
                    }
                    self.hotels.append(
                        {
                            **identity,
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
                    )
                    self.rooms.extend(
                        {
                            **identity,
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
                    )
            self._checked[hotel.id] = status
            results.append({"hotel_id": hotel.id, "status": status})
        return {
            "source": "provider",
            "missing_room_hotel_ids": [
                row["hotel_id"]
                for row in results
                if not any(room["hotel_id"] == row["hotel_id"] for room in self.rooms)
            ],
            "unavailable": bool(results) and all(row["status"] == "unavailable" for row in results),
            "hotels": results,
            "hotel_record_count": len(self.hotels),
            "room_record_count": len(self.rooms),
            "note": "Read provider_hotels/provider_rooms with match_records. Catalog does not establish dated availability.",
        }
