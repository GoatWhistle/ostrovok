from dataclasses import dataclass, field
from typing import Any, Protocol

from hotel_agent.application.ports.hotel_discovery import (
    CatalogProviderFailure,
)
from hotel_agent.domain.hotel_identity import HotelIdentity


@dataclass(frozen=True, slots=True)
class CatalogRoom:
    supplier_id: str
    name: str
    max_adults: int
    amenities: tuple[str, ...]
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class CatalogHotel:
    supplier_id: str
    name: str
    rooms: tuple[CatalogRoom, ...]
    facilities_ru: tuple[str, ...] = ()
    facilities_en: tuple[str, ...] = ()
    details: dict[str, Any] = field(default_factory=dict)
    identity: HotelIdentity | None = None


class HotelCatalogSource(Protocol):
    async def get_hotel(self, supplier_id: str) -> CatalogHotel: ...


class HotelCatalogStore(Protocol):
    async def save(self, hotel_id: str, hotel: CatalogHotel) -> int: ...


class CatalogMappingConflict(Exception):
    pass


__all__ = [
    "CatalogHotel",
    "CatalogMappingConflict",
    "CatalogProviderFailure",
    "CatalogRoom",
    "HotelCatalogSource",
    "HotelCatalogStore",
]
