from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.page_library import PageLibrary
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort

NOW = datetime(2026, 10, 26, tzinfo=UTC)
CYRILLIC = "https://ru.example.org/wiki/Англетер"
ENCODED = "https://ru.example.org/wiki/%D0%90%D0%BD%D0%B3%D0%BB%D0%B5%D1%82%D0%B5%D1%80"


def hotel() -> SearchHotelRecord:
    return SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Англетер",
        location=(30.3, 59.9),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def library(read: AsyncMock) -> PageLibrary:
    return PageLibrary(cast(WebResearchPort, SimpleNamespace(read=read)))


async def test_same_address_in_another_encoding_is_read_once() -> None:
    read = AsyncMock(return_value=WebPage(CYRILLIC, "Англетер", "Здесь жил поэт. " * 40, NOW))
    pages = library(read)

    first = await pages.read(CYRILLIC, hotel(), {}, "")
    second = await pages.read(ENCODED, hotel(), {}, "")

    assert first["source_url"] == second["source_url"]
    read.assert_awaited_once_with(CYRILLIC)
    assert len(pages.pages) == 1


async def test_blocked_page_names_its_cause_and_is_not_requested_again() -> None:
    read = AsyncMock(side_effect=ValueError("blocked: the site refused automated reading"))
    pages = library(read)

    first = await pages.read(CYRILLIC, hotel(), {}, "")
    second = await pages.read(ENCODED, hotel(), {}, "")

    assert first["error"].startswith("blocked:")
    assert second["error"] == first["error"]
    assert "another source" in second["note"]
    read.assert_awaited_once()
    assert pages.pages == []


async def test_truncated_address_is_reported_without_a_request() -> None:
    read = AsyncMock()
    result = await library(read).read(ENCODED[:-2], hotel(), {}, "")

    assert result["error"].startswith("invalid_url:")
    read.assert_not_awaited()


async def test_page_without_readable_text_is_marked_as_insufficient() -> None:
    read = AsyncMock(return_value=WebPage(CYRILLIC, "Tripster", "Tripster — экскурсии", NOW))
    result = await library(read).read(CYRILLIC, hotel(), {}, "")

    assert result["insufficient_text"] == len("Tripster — экскурсии")
    assert "another source" in result["note"]
