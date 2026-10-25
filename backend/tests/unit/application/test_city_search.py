from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality


def search(
    parsed: ParsedQuery, city_bbox: tuple[float, float, float, float] | None = None
) -> tuple[SearchHotels, SimpleNamespace, SimpleNamespace, MagicMock]:
    llm = SimpleNamespace(parse_query=AsyncMock(return_value=parsed))
    regions = SimpleNamespace(city_bbox=AsyncMock(return_value=city_bbox))
    hotel = SearchHotelRecord(
        id="m1",
        region_id="russia",
        name="Гостиница в Москве",
        location=(37.61, 55.75),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    hotels = SimpleNamespace(
        list_hotels=AsyncMock(return_value=[hotel]),
        list_facts=AsyncMock(return_value=[]),
        list_supplier_content=AsyncMock(return_value=[]),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            regions=regions, search=hotels, nearby_objects=SimpleNamespace()
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    clock = SimpleNamespace(now=lambda: datetime(2026, 10, 25, tzinfo=UTC))
    use_case = SearchHotels(
        cast(LLMPort, llm), cast(UnitOfWorkFactory, lambda: scope), cast(ClockPort, clock)
    )
    return use_case, regions, hotels, scope


async def test_missing_city_asks_before_accessing_hotels() -> None:
    use_case, _, hotels, scope = search(
        ParsedQuery(intents=(), unmatched_terms=(), location_hint=None)
    )

    result = await use_case("тихий номер", "russia", None, 20)

    assert result.parsed.needs_clarification
    assert result.results == ()
    scope.__aenter__.assert_not_awaited()
    hotels.list_hotels.assert_not_awaited()


async def test_city_routes_search_to_national_hotels_and_keeps_unknown_rooms() -> None:
    wanted = Intent(
        characteristic_key="room_capacity",
        op=Op.GTE,
        value=2.0,
        weight=1.0,
        required=True,
        source_text="двухместный номер",
    )
    use_case, regions, hotels, _ = search(
        ParsedQuery(intents=(wanted,), unmatched_terms=(), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )

    result = await use_case("двухместный номер в Москве", "sochi", None, 20)

    regions.city_bbox.assert_awaited_once_with("Москва")
    hotels.list_hotels.assert_awaited_once_with("russia", (37.4, 55.5, 37.9, 56.0))
    assert len(result.results) == 1
    assert result.results[0].scored.matches[0].quality is MatchQuality.UNKNOWN


async def test_unindexed_city_is_reported_without_searching_all_russia() -> None:
    use_case, _, hotels, _ = search(
        ParsedQuery(intents=(), unmatched_terms=(), location_hint="Несуществующий")
    )

    result = await use_case("отель в Несуществующем", "russia", None, 20)

    assert result.results == ()
    assert result.parsed.unsupported_region == "Несуществующий"
    hotels.list_hotels.assert_not_awaited()
