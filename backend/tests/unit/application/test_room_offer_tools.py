from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.room_offer_tools import RoomOfferTools
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_offers import RoomOffer
from hotel_agent.application.use_cases.get_hotel_offers import (
    GetHotelOffers,
    HotelOffers,
    OfferStatus,
)


def hotel() -> SearchHotelRecord:
    return SearchHotelRecord(
        id="h1",
        region_id="sochi",
        name="Отель",
        location=(39.7, 43.5),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def offers(status: OfferStatus, available: tuple[RoomOffer, ...]) -> HotelOffers:
    return HotelOffers(
        hotel_id="h1",
        check_in=date(2026, 11, 1),
        check_out=date(2026, 11, 3),
        adults=2,
        status=status,
        source="nuitee",
        sandbox=True,
        checked_at=datetime(2026, 10, 26, tzinfo=UTC),
        offers=available,
    )


async def test_room_tool_keeps_total_price_currency_and_sandbox_label() -> None:
    offer = RoomOffer(
        id="o1",
        room_name="Двухместный",
        price_amount=12000,
        price_currency="RUB",
        available_rooms=1,
        meal="Завтрак",
        amenities=(),
        floor_number=3,
    )
    lookup = AsyncMock(return_value=offers(OfferStatus.AVAILABLE, (offer,)))
    metrics: dict[str, dict[str, float]] = {}
    descriptions: dict[str, str] = {}
    tool = RoomOfferTools(cast(GetHotelOffers, lookup), lambda: [hotel()], metrics, descriptions)

    result = await tool.execute(
        {"hotel_ids": ["h1"], "check_in": "2026-11-01", "check_out": "2026-11-03", "adults": 2}
    )

    assert metrics["h1"]["offers1.min_total_price_RUB"] == 12000
    assert "тестовая" in descriptions["offers1.min_total_price_RUB"]
    assert result["hotels"][0]["offers"][0]["floor_number"] == 3
    lookup.assert_awaited_once_with("h1", date(2026, 11, 1), date(2026, 11, 3), 2, "ru")


async def test_unmapped_hotel_does_not_produce_zero_availability() -> None:
    lookup = AsyncMock(return_value=offers(OfferStatus.HOTEL_UNMAPPED, ()))
    metrics: dict[str, dict[str, float]] = {}
    tool = RoomOfferTools(cast(GetHotelOffers, lookup), lambda: [hotel()], metrics, {})
    await tool.execute(
        {"hotel_ids": ["h1"], "check_in": "2026-11-01", "check_out": "2026-11-03", "adults": 2}
    )
    assert metrics == {}
