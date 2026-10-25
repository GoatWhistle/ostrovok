from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class CatalogRoom:
    supplier_id: str
    name: str
    max_adults: int
    amenities: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CatalogHotel:
    supplier_id: str
    name: str
    rooms: tuple[CatalogRoom, ...]


class HotelCatalogSource(Protocol):
    async def get_hotel(self, supplier_id: str) -> CatalogHotel: ...


class HotelCatalogStore(Protocol):
    async def save(self, hotel_id: str, hotel: CatalogHotel) -> int: ...
