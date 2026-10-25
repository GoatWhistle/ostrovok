import httpx

from hotel_agent.application.ports.hotel_catalog import CatalogHotel, CatalogRoom

URL = "https://api.liteapi.travel/v3.0/data/hotel"


class NuiteeCatalog:
    def __init__(self, api_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._client = client

    async def get_hotel(self, supplier_id: str) -> CatalogHotel:
        params = {"hotelId": supplier_id, "language": "ru"}
        headers = {"X-API-Key": self._api_key}
        if self._client is None:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(URL, params=params, headers=headers)
        else:
            response = await self._client.get(URL, params=params, headers=headers)
        response.raise_for_status()
        hotel = response.json()["data"]
        if hotel.get("id") != supplier_id:
            raise ValueError("Supplier hotel ID mismatch")
        rooms = tuple(
            CatalogRoom(
                supplier_id=str(room["id"]),
                name=str(room["roomName"]),
                max_adults=int(room["maxAdults"]),
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
        return CatalogHotel(supplier_id=supplier_id, name=str(hotel["name"]), rooms=rooms)
