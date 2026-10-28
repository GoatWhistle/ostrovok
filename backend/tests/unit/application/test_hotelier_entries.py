from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.use_cases.hotelier_entries import ManageHotelierEntries
from hotel_agent.domain.errors import HotelNotFound, InvalidValue
from tests.unit.application.hotelier_fakes import FixedClock


@pytest.mark.asyncio
async def test_entry_trims_input_and_commits_after_saving() -> None:
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.facts.lock_hotel = AsyncMock(return_value=True)
    uow.hotelier_entries.save = AsyncMock()
    uow.commit = AsyncMock()
    result = await ManageHotelierEntries(lambda: uow, FixedClock()).save(
        "h1", "e1", " Arrival ", " After 10am "
    )
    assert result.title == "Arrival"
    assert result.description == "After 10am"
    uow.hotelier_entries.save.assert_awaited_once_with(result)
    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("title", "description"), [(" ", "x"), ("x", " "), ("x" * 81, "y"), ("x", "y" * 1001)]
)
async def test_invalid_entry_never_opens_transaction(title: str, description: str) -> None:
    factory = MagicMock()
    with pytest.raises(InvalidValue):
        await ManageHotelierEntries(factory, FixedClock()).save("h1", "e1", title, description)
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_unknown_hotel_is_rejected_before_write() -> None:
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.facts.lock_hotel = AsyncMock(return_value=False)
    uow.search.get_hotel = AsyncMock(return_value=None)
    service = ManageHotelierEntries(lambda: uow, FixedClock())
    with pytest.raises(HotelNotFound):
        await service.save("missing", "e1", "Arrival", "After 10am")
    with pytest.raises(HotelNotFound):
        await service.list("missing")
    uow.hotelier_entries.save.assert_not_called()
    uow.commit.assert_not_called()
