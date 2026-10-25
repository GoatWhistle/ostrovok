from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import OfferLookup, RoomOffer
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers, OfferStatus
from hotel_agent.domain.errors import InvalidQuery


def repository(supplier_id: str | None) -> UnitOfWorkFactory:
    search = SimpleNamespace(
        get_hotel=AsyncMock(return_value=SimpleNamespace(id="hotel-1")),
        get_supplier_id=AsyncMock(return_value=supplier_id),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(return_value=SimpleNamespace(search=search))
    scope.__aexit__ = AsyncMock(return_value=None)
    return cast(UnitOfWorkFactory, lambda: scope)


def clock() -> ClockPort:
    return cast(ClockPort, SimpleNamespace(now=lambda: datetime(2026, 10, 25, tzinfo=UTC)))


@pytest.mark.asyncio
async def test_unconfigured_provider_is_not_reported_as_sold_out() -> None:
    result = await GetHotelOffers(repository(None), None, clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.PROVIDER_UNAVAILABLE
    assert result.offers == ()


@pytest.mark.asyncio
async def test_unmapped_hotel_does_not_call_supplier() -> None:
    provider = SimpleNamespace(
        fetch=AsyncMock(), supplier="nuitee", source="Nuitee Connect", sandbox=True
    )
    result = await GetHotelOffers(repository(None), cast(Any, provider), clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.HOTEL_UNMAPPED
    provider.fetch.assert_not_called()


@pytest.mark.asyncio
async def test_mapped_hotel_returns_provider_rate() -> None:
    checked_at = datetime(2026, 10, 25, tzinfo=UTC)
    rate = RoomOffer(
        id="rate-1",
        room_name="Двухместный номер",
        price_amount=12000,
        price_currency="RUB",
        available_rooms=2,
        meal="breakfast",
        amenities=(),
    )
    provider = SimpleNamespace(
        fetch=AsyncMock(return_value=OfferLookup((rate,), checked_at)),
        supplier="nuitee",
        source="Nuitee Connect",
        sandbox=True,
    )
    result = await GetHotelOffers(repository("42"), cast(Any, provider), clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.AVAILABLE
    assert result.offers == (rate,)
    assert result.sandbox is True
    provider.fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_invalid_dates_are_rejected_before_supplier_call() -> None:
    with pytest.raises(InvalidQuery):
        await GetHotelOffers(repository("42"), None, clock())(
            "hotel-1", date(2026, 11, 2), date(2026, 11, 1), 2, "ru"
        )
