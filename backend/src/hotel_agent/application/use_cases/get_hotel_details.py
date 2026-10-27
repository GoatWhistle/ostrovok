from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.supplier_details import HotelDetailsPort, SupplierHotel
from hotel_agent.domain.errors import HotelNotFound
from hotel_agent.domain.hotel_identity import HotelIdentity

CITY_RADIUS_M = 25_000


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

    async def __call__(self, hotel_id: str) -> SupplierHotel | None:
        if self._provider is None:
            return None
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            city = hotel.city or await uow.search.nearby_city(hotel.location, CITY_RADIUS_M)
        return await self._provider.details(
            HotelIdentity(
                name=hotel.name, address=hotel.address, location=hotel.location, city=city
            )
        )
