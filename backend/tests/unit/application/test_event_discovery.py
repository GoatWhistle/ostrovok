from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.ports.place_research import PlaceResearchResult
from hotel_agent.application.ports.web_research import WebPage
from tests.unit.application.test_place_tools import ARGUMENTS, EVENT, NOW
from tests.unit.application.test_research_tools import HOTEL


async def test_event_discovery_without_trip_dates_searches_web_without_hotel_claims() -> None:
    page = WebPage("https://example.org/concert", "Concert", "Venue and date", NOW)
    web = SimpleNamespace(search=AsyncMock(return_value=[page]), read=AsyncMock(return_value=page))
    tools = DataTools(
        MagicMock(),
        MagicMock(),
        [HOTEL],
        "Москва",
        "russia",
        None,
        False,
        web=web,
        now=NOW,
        places={"search_events": SimpleNamespace(research=AsyncMock())},
    )
    result = await tools.execute("search_events", {"query": "Кишлак"})
    assert result["discovery_only"] is True
    assert result["hits"][0]["url"] == page.url
    assert "Москва" in web.search.call_args.args[0]
    assert not tools.metrics


async def test_general_source_page_can_be_read_without_assigning_to_arbitrary_hotel() -> None:
    page = WebPage("https://example.org/concert", "Concert", "Venue and date", NOW)
    web = SimpleNamespace(read=AsyncMock(return_value=page))
    tools = DataTools(
        MagicMock(), MagicMock(), [HOTEL], "Москва", "russia", None, False, web=web, now=NOW
    )
    result = await tools.execute("read_web_page", {"url": page.url})
    assert result["text"] == page.text
    assert result["discovery_only"] is True
    assert not tools.research.pages
    assert not tools.metrics


async def test_empty_or_unavailable_afisha_falls_back_to_web() -> None:

    web = SimpleNamespace(search=AsyncMock(return_value=[]))
    provider = SimpleNamespace(research=AsyncMock(return_value=PlaceResearchResult()))
    tools = DataTools(
        MagicMock(),
        MagicMock(),
        [HOTEL],
        "Москва",
        "russia",
        None,
        False,
        web=web,
        now=NOW,
        places={"search_events": provider},
    )
    result = await tools.execute("search_events", ARGUMENTS)
    assert result["discovery_only"] is True
    web.search.assert_awaited_once()
    provider.research.side_effect = ValueError("upstream unavailable")
    result = await tools.execute("search_events", ARGUMENTS)
    assert result["errors"]
    assert web.search.await_count == 2
    assert not tools.metrics


async def test_read_event_page_checks_hotels_beyond_first_four_with_one_page_read() -> None:

    provider = SimpleNamespace(
        research=AsyncMock(return_value=PlaceResearchResult(records=(EVENT,)))
    )
    hotels = [replace(HOTEL, id=f"h{i}", location=(40.0, 44.0)) for i in range(4)]
    hotels.append(replace(HOTEL, id="near_venue"))
    tools = DataTools(
        MagicMock(),
        MagicMock(),
        hotels,
        "Сочи",
        "russia",
        None,
        False,
        now=NOW,
        places={"read_event_page": provider},
    )
    result = await tools.execute(
        "read_event_page", {**ARGUMENTS, "hotel_ids": [], "url": EVENT["source_url"]}
    )
    assert result["checked_hotel_count"] == 5
    assert len(result["measurements"]) == 1
    assert result["measurements"][0]["records"][0]["distance_m"] < 200
    assert tools.places.events[0]["hotel_id"] == "near_venue"
    provider.research.assert_awaited_once()
