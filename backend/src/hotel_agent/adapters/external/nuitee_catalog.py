import httpx

from hotel_agent.adapters.external.nuitee_identity import hotel_identity
from hotel_agent.application.ports.hotel_catalog import CatalogHotel, CatalogRoom
from hotel_agent.application.ports.hotel_discovery import CatalogProviderFailure

URL = "https://api.liteapi.travel/v3.0/data/hotel"


class NuiteeCatalog:
    def __init__(self, api_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._client = client

    async def get_hotel(self, supplier_id: str) -> CatalogHotel:
        try:
            return await self._get_hotel(supplier_id)
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise CatalogProviderFailure("Nuitee hotel details failed") from error

    async def _get_hotel(self, supplier_id: str) -> CatalogHotel:
        params = {"hotelId": supplier_id, "language": "ru"}
        headers = {"X-API-Key": self._api_key}
        if self._client is None:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(URL, params=params, headers=headers)
        else:
            response = await self._client.get(URL, params=params, headers=headers)
        response.raise_for_status()
        body = response.json()
        if (
            not isinstance(body, dict)
            or body.get("error")
            or not isinstance(body.get("data"), dict)
        ):
            raise ValueError("Invalid hotel detail response")
        hotel = body["data"]
        if hotel.get("id") != supplier_id:
            raise ValueError("Supplier hotel ID mismatch")
        if not isinstance(hotel.get("name"), str) or not hotel["name"].strip():
            raise ValueError("Hotel name is required")
        rooms = tuple(
            CatalogRoom(
                supplier_id=str(room["id"]),
                name=str(room["roomName"]),
                max_adults=int(room["maxAdults"]),
                details=dict(room),
                amenities=tuple(
                    str(item["name"])
                    for item in room.get("roomAmenities", [])
                    if isinstance(item, dict) and item.get("name")
                ),
            )
            for room in hotel.get("rooms", [])
            if isinstance(room, dict)
            and room.get("id") is not None
            and room.get("roomName")
            and isinstance(room.get("maxAdults"), int)
            and room["maxAdults"] > 0
        )
        facilities_ru = tuple(
            dict.fromkeys(
                str(item["name"])
                for item in hotel.get("facilities", [])
                if isinstance(item, dict) and item.get("name")
            )
        )
        facilities_en = tuple(
            dict.fromkeys(
                str(item)
                for item in hotel.get("hotelFacilities", [])
                if isinstance(item, str) and item.strip()
            )
        )
        try:
            identity = hotel_identity(hotel)
        except (ValueError, TypeError):
            identity = None
        return CatalogHotel(
            supplier_id=supplier_id,
            name=str(hotel["name"]),
            rooms=rooms,
            facilities_ru=facilities_ru,
            facilities_en=facilities_en,
            details=dict(hotel),
            identity=identity,
        )
