from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.agent import catalog_records, supplier_records
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_catalog import CatalogProviderFailure, HotelCatalogSource
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.get_hotel_details import GetHotelDetails

NOTE = (
    "Read provider_hotels/provider_rooms with match_records. "
    "Catalog does not establish dated availability."
)


class ProviderContent:
    def __init__(
        self,
        source: HotelCatalogSource | None,
        uow: UnitOfWorkFactory,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        details: GetHotelDetails | None = None,
    ) -> None:
        self._source, self._uow, self._hotels = source, uow, hotels
        self._details = details if details is not None and details.configured else None
        self.hotels: list[dict[str, Any]] = []
        self.rooms: list[dict[str, Any]] = []
        self._checked: dict[str, str] = {}

    async def read(self, hotel_ids: Sequence[str]) -> dict[str, Any]:
        if self._source is None and self._details is None:
            return {
                "unavailable": True,
                "error": "Provider content is not configured",
                "missing_room_hotel_ids": list(hotel_ids),
            }
        selected = [hotel for hotel in self._hotels() if hotel.id in hotel_ids][:4]
        if not selected:
            raise ValueError("Select 1\u20134 hotel_ids from the candidates")
        results = []
        for hotel in selected:
            if hotel.id in self._checked:
                results.append(
                    {"hotel_id": hotel.id, "status": self._checked[hotel.id], "cached": True}
                )
                continue
            status = await self._supplier(hotel)
            if status is None:
                status = await self._catalog(hotel)
            self._checked[hotel.id] = status
            results.append({"hotel_id": hotel.id, "status": status})
        return self._summary(results)

    async def _supplier(self, hotel: SearchHotelRecord) -> str | None:
        if self._details is None:
            return None
        source = self._details.source or "provider"
        try:
            found = await self._details(hotel.id)
        except OfferProviderFailure:
            return "unavailable"
        if found is None:
            return None
        self.hotels.append(supplier_records.hotel_record(hotel, found, source))
        self.rooms.extend(supplier_records.room_records(hotel, found, source))
        return "available"

    async def _catalog(self, hotel: SearchHotelRecord) -> str:
        if self._source is None:
            return "unmapped"
        async with self._uow() as uow:
            supplier_id = await uow.search.get_supplier_id(hotel.id, "nuitee")
        if supplier_id is None:
            return "unmapped"
        try:
            catalog = await self._source.get_hotel(supplier_id)
        except CatalogProviderFailure:
            return "unavailable"
        self.hotels.append(catalog_records.hotel_record(hotel, catalog, supplier_id))
        self.rooms.extend(catalog_records.room_records(hotel, catalog, supplier_id))
        return "available"

    def _summary(self, results: list[dict[str, Any]]) -> dict[str, Any]:
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
            "note": NOTE,
        }
