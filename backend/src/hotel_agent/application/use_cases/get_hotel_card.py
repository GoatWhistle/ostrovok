from dataclasses import dataclass

from hotel_agent.application.dto import ConflictRecord, SearchHotelRecord, SupplierContentRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.domain.entities import Fact, QuestionStatus, Resolution
from hotel_agent.domain.errors import HotelNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelCard:
    hotel: SearchHotelRecord
    rooms: tuple[RoomRecord, ...]
    facts: tuple[Fact, ...]
    supplier_content: SupplierContentRecord | None
    conflicts: tuple[ConflictRecord, ...] = ()
    stale_count: int = 0
    open_questions: int = 0


class GetHotelCard:
    def __init__(self, uow: UnitOfWorkFactory, clock: ClockPort) -> None:
        self._uow, self._clock = uow, clock

    async def __call__(self, hotel_id: str) -> HotelCard:
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            rows = await uow.search.list_facts(None, hotel_id, (hotel_id,))
            rooms = await uow.search.list_rooms(hotel_id)
            content = await uow.search.get_supplier_content(hotel_id)
            conflicts = await uow.facts.conflicts(hotel_id)
            questions = await uow.questions.for_hotel(hotel_id)
        facts = tuple(fact_from_record(row) for row in rows if row.hotel_id == hotel_id)
        now = self._clock.now()
        return HotelCard(
            hotel=hotel,
            rooms=tuple(rooms),
            facts=facts,
            supplier_content=content,
            conflicts=tuple(
                item for item in conflicts if item.resolution == Resolution.PENDING.value
            ),
            stale_count=sum(1 for fact in facts if fact.is_stale_at(now)),
            open_questions=sum(1 for item in questions if item.status == QuestionStatus.OPEN.value),
        )
