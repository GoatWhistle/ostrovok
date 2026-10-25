from dataclasses import dataclass

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.errors import HotelNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelCard:
    hotel: SearchHotelRecord
    facts: tuple[Fact, ...]


class GetHotelCard:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, hotel_id: str) -> HotelCard:
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            rows = await uow.search.list_facts(hotel.region_id)
        return HotelCard(
            hotel=hotel,
            facts=tuple(fact_from_record(row) for row in rows if row.hotel_id == hotel_id),
        )
