from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RoomOffer:
    id: str
    room_name: str
    price_amount: float
    price_currency: str
    available_rooms: int | None
    meal: str | None
    amenities: tuple[str, ...]
    floor_number: int | None = None


@dataclass(frozen=True, slots=True)
class OfferLookup:
    offers: tuple[RoomOffer, ...]
    checked_at: datetime


class HotelOffersPort(Protocol):
    supplier: str
    source: str
    sandbox: bool

    async def fetch(
        self, supplier_id: str, check_in: date, check_out: date, adults: int, residency: str
    ) -> OfferLookup: ...


class OfferProviderFailure(Exception):
    pass
