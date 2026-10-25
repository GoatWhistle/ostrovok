from hotel_agent.application.ports.hotel_catalog import HotelCatalogSource, HotelCatalogStore


class SyncHotelCatalog:
    def __init__(self, source: HotelCatalogSource, store: HotelCatalogStore) -> None:
        self._source = source
        self._store = store

    async def __call__(self, hotel_id: str, supplier_id: str) -> int:
        hotel = await self._source.get_hotel(supplier_id)
        if hotel.supplier_id != supplier_id:
            raise ValueError("Supplier hotel ID mismatch")
        return await self._store.save(hotel_id, hotel)
