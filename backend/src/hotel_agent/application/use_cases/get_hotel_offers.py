from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from zoneinfo import ZoneInfo

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import (
    HotelOffersPort,
    OfferProviderFailure,
    RoomOffer,
)
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery


class OfferStatus(StrEnum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    HOTEL_UNMAPPED = "hotel_unmapped"
    PROVIDER_ERROR = "provider_error"
    SOLD_OUT = "sold_out"
    AVAILABLE = "available"


@dataclass(frozen=True, slots=True)
class HotelOffers:
    hotel_id: str
    check_in: date
    check_out: date
    adults: int
    status: OfferStatus
    source: str | None
    checked_at: datetime | None
    offers: tuple[RoomOffer, ...]


class GetHotelOffers:
    def __init__(
        self, uow: UnitOfWorkFactory, provider: HotelOffersPort | None, clock: ClockPort
    ) -> None:
        self._uow = uow
        self._provider = provider
        self._clock = clock

    async def __call__(
        self, hotel_id: str, check_in: date, check_out: date, adults: int, residency: str
    ) -> HotelOffers:
        if check_out <= check_in or (check_out - check_in).days > 30:
            raise InvalidQuery("Check-out must follow check-in by at most 30 nights")
        today = self._clock.now().astimezone(ZoneInfo("Europe/Moscow")).date()
        if check_in < today or (check_in - today).days > 730:
            raise InvalidQuery("Check-in must be within the next 730 days")
        if adults < 1 or adults > 10 or len(residency) != 2 or not residency.isalpha():
            raise InvalidQuery("Invalid guest details")
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            supplier_id = await uow.search.get_supplier_id(hotel_id, "etg")
        status = OfferStatus.HOTEL_UNMAPPED
        source = None
        checked_at = None
        offers: tuple[RoomOffer, ...] = ()
        if self._provider is None:
            status = OfferStatus.PROVIDER_UNAVAILABLE
        elif supplier_id is not None:
            source = "ETG/RateHawk"
            try:
                result = await self._provider.fetch(
                    int(supplier_id), check_in, check_out, adults, residency.lower()
                )
            except OfferProviderFailure:
                status = OfferStatus.PROVIDER_ERROR
            else:
                checked_at = result.checked_at
                offers = result.offers
                status = OfferStatus.AVAILABLE if offers else OfferStatus.SOLD_OUT
        return HotelOffers(
            hotel_id=hotel_id,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            status=status,
            source=source,
            checked_at=checked_at,
            offers=offers,
        )
