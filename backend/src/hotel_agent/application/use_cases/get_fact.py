from dataclasses import dataclass

from hotel_agent.application.dto import ConflictRecord
from hotel_agent.application.fact_records import FactOwner, fact_from_record
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.errors import FactNotFound, HotelNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class FactDetail:
    fact: Fact
    history: tuple[Fact, ...]
    conflicts: tuple[ConflictRecord, ...]


class GetFact:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, hotel_id: str, fact_id: str) -> FactDetail:
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
            record = await uow.facts.get(fact_id)
            if record is None or record.hotel_id != hotel_id:
                raise FactNotFound()
            owner = FactOwner.of(record)
            versions = await uow.facts.versions(
                owner.subject_type, owner.subject_id, record.characteristic_key
            )
            conflicts = await uow.facts.conflicts(hotel_id, fact_id)
        return FactDetail(
            fact=fact_from_record(record),
            history=tuple(fact_from_record(item) for item in versions if item.id != fact_id),
            conflicts=tuple(conflicts),
        )
