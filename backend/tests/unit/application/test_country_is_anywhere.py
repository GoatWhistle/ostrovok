from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SearchDocument, SemanticSearchPort
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.domain.query import ParsedQuery

HOTEL = SearchHotelRecord(
    id="m1",
    region_id="russia",
    name="Горный",
    location=(42.7, 43.9),
    stars=None,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)


def use_case(parsed: ParsedQuery) -> SearchHotels:
    hotels = SimpleNamespace(
        list_hotels=AsyncMock(return_value=[HOTEL]),
        by_ids=AsyncMock(return_value=[HOTEL]),
        list_facts=AsyncMock(return_value=[]),
        list_supplier_content=AsyncMock(return_value=[]),
        list_rooms_by_hotels=AsyncMock(return_value={}),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            regions=SimpleNamespace(
                city_bbox=AsyncMock(return_value=None), local_area=AsyncMock(return_value=None)
            ),
            search=hotels,
            nearby_objects=SimpleNamespace(),
            geo_features=SimpleNamespace(get_batch=AsyncMock(return_value=())),
            named_places=SimpleNamespace(geographic_name=AsyncMock(return_value=None)),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    semantic = SimpleNamespace(
        search=AsyncMock(
            return_value=[SearchDocument(id="hotel:m1", hotel_id="m1", text="gory", source="db")]
        )
    )
    return SearchHotels(
        cast(LLMPort, SimpleNamespace(parse_query=AsyncMock(return_value=parsed))),
        cast(UnitOfWorkFactory, lambda: scope),
        cast(ClockPort, SimpleNamespace(now=lambda: datetime(2026, 10, 28, tzinfo=UTC))),
        semantic=cast(SemanticSearchPort, semantic),
    )


async def test_naming_the_whole_country_searches_everywhere_instead_of_asking() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Россия")

    result = await use_case(parsed)("отель с видом на горы, Россия", "russia", None, 20)

    assert result.parsed.anywhere
    assert not result.parsed.needs_clarification
    assert [item.hotel.id for item in result.results] == ["m1"]


async def test_no_location_at_all_still_asks_for_a_city() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint=None)

    result = await use_case(parsed)("тихий отель", "russia", None, 20)

    assert result.parsed.needs_clarification
    assert result.results == ()
