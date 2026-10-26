from dataclasses import dataclass
from math import cos, radians

from hotel_agent.application.dto import BuildingRecord, FacadeRecord, SearchHotelRecord
from hotel_agent.application.ports.geography import GeographyContextPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelScene:
    hotel: SearchHotelRecord
    facades: tuple[FacadeRecord, ...]
    context_buildings: tuple[BuildingRecord, ...]


class GetHotelScene:
    def __init__(
        self, uow: UnitOfWorkFactory, geography: GeographyContextPort | None = None
    ) -> None:
        self._uow = uow
        self._geography = geography

    async def __call__(self, hotel_id: str, radius_m: float) -> HotelScene:
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
        if self._geography is not None:
            lon, lat = hotel.location
            dy = max(100, radius_m) / 111200
            dx = dy / max(cos(radians(lat)), 0.01)
            await self._geography.area(
                (max(-180, lon - dx), lat - dy, min(180, lon + dx), lat + dy), hotel.region_id
            )
        async with self._uow() as uow:
            updated = await uow.search.get_hotel(hotel_id)
            if updated is not None:
                hotel = updated
            facades = await uow.search.list_facades(hotel_id)
            context = await uow.search.list_context_buildings(hotel_id, radius_m)
        return HotelScene(hotel=hotel, facades=tuple(facades), context_buildings=tuple(context))
