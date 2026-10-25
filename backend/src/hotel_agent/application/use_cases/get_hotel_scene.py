from dataclasses import dataclass

from hotel_agent.application.dto import BuildingRecord, FacadeRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelScene:
    hotel: SearchHotelRecord
    facades: tuple[FacadeRecord, ...]
    context_buildings: tuple[BuildingRecord, ...]


class GetHotelScene:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, hotel_id: str, radius_m: float) -> HotelScene:
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            facades = await uow.search.list_facades(hotel_id)
            context = await uow.search.list_context_buildings(hotel_id, radius_m)
        return HotelScene(hotel=hotel, facades=tuple(facades), context_buildings=tuple(context))
