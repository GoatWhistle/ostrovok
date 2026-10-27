from dataclasses import dataclass
from enum import StrEnum

from hotel_agent.application.ports.hotel_offers import OfferProviderFailure
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.supplier_details import (
    HotelDetailsPort,
    SupplierDetails,
    SupplierRoom,
)
from hotel_agent.domain.errors import HotelNotFound
from hotel_agent.domain.hotel_identity import HotelIdentity

CITY_RADIUS_M = 25_000


class DetailsStatus(StrEnum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    HOTEL_UNMAPPED = "hotel_unmapped"
    PROVIDER_ERROR = "provider_error"
    AVAILABLE = "available"


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelDetails:
    hotel_id: str
    status: DetailsStatus
    source: str | None = None
    sandbox: bool = False
    details: SupplierDetails | None = None
    rooms: tuple[SupplierRoom, ...] = ()


class GetHotelDetails:
    def __init__(self, uow: UnitOfWorkFactory, provider: HotelDetailsPort | None) -> None:
        self._uow = uow
        self._provider = provider

    @property
    def source(self) -> str | None:
        return self._provider.source if self._provider is not None else None

    @property
    def configured(self) -> bool:
        return self._provider is not None

    async def __call__(self, hotel_id: str) -> HotelDetails:
        provider = self._provider
        if provider is None:
            return HotelDetails(hotel_id=hotel_id, status=DetailsStatus.PROVIDER_UNAVAILABLE)
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            city = hotel.city or await uow.search.nearby_city(hotel.location, CITY_RADIUS_M)
        identity = HotelIdentity(
            name=hotel.name, address=hotel.address, location=hotel.location, city=city
        )
        try:
            found = await provider.details(identity)
        except OfferProviderFailure:
            return HotelDetails(
                hotel_id=hotel_id,
                status=DetailsStatus.PROVIDER_ERROR,
                source=provider.source,
                sandbox=provider.sandbox,
            )
        if found is None:
            return HotelDetails(
                hotel_id=hotel_id,
                status=DetailsStatus.HOTEL_UNMAPPED,
                source=provider.source,
                sandbox=provider.sandbox,
            )
        return HotelDetails(
            hotel_id=hotel_id,
            status=DetailsStatus.AVAILABLE,
            source=provider.source,
            sandbox=provider.sandbox,
            details=found.details,
            rooms=found.rooms,
        )
