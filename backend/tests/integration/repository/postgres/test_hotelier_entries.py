from uuid import uuid4

import pytest

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.application.ports.hotelier_entries import HotelierEntry
from hotel_agent.application.use_cases.hotelier_entries import ManageHotelierEntries
from tests.integration.repository.postgres.hotelier_setup import seed_hotel


@pytest.mark.asyncio
async def test_entry_persists_and_updates_without_duplicates(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    _, other = await seed_hotel(disposable_database)
    factory = PostgresUnitOfWorkFactory(disposable_database)
    try:
        entries = ManageHotelierEntries(factory, SystemClock())
        key = str(uuid4())
        await entries.save(hotel, key, "Early arrival", "After 10am")
        await entries.save(hotel, key, "Early arrival", "After noon")
        assert len(await entries.list(hotel)) == 1
        assert (await entries.list(hotel))[0].description == "After noon"
        assert await entries.list(other) == ()
        await entries.save(other, key, "Parking", "Free")
        assert (await entries.list(hotel))[0].title == "Early arrival"
        async with factory() as uow:
            await uow.hotelier_entries.save(
                HotelierEntry(str(uuid4()), hotel, "Rollback", "Not saved", SystemClock().now())
            )
        assert len(await entries.list(hotel)) == 1
        await factory.aclose()
        factory = PostgresUnitOfWorkFactory(disposable_database)
        entries = ManageHotelierEntries(factory, SystemClock())
        assert (await entries.list(hotel))[0].title == "Early arrival"
    finally:
        await factory.aclose()
