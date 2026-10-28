from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotelier_entries import HotelierEntry
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound, InvalidValue


class ManageHotelierEntries:
    def __init__(self, uow: UnitOfWorkFactory, clock: ClockPort) -> None:
        self._uow, self._clock = uow, clock

    async def list(self, hotel_id: str) -> tuple[HotelierEntry, ...]:
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
            return tuple(await uow.hotelier_entries.for_hotel(hotel_id))

    async def save(
        self, hotel_id: str, entry_id: str, title: str, description: str
    ) -> HotelierEntry:
        title, description = title.strip(), description.strip()
        if not 1 <= len(title) <= 80 or not 1 <= len(description) <= 1000:
            raise InvalidValue("Entry requires a title (1-80) and description (1-1000)")
        entry = HotelierEntry(entry_id, hotel_id, title, description, self._clock.now())
        async with self._uow() as uow:
            if not await uow.facts.lock_hotel(hotel_id):
                raise HotelNotFound()
            await uow.hotelier_entries.save(entry)
            await uow.commit()
        return entry
