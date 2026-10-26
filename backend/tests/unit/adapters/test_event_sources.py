import json
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.application.ports.place_research import PlaceResearchRequest
from hotel_agent.application.ports.web_research import WebPage

START = datetime(2026, 10, 27, tzinfo=UTC)
END = datetime(2026, 10, 29, tzinfo=UTC)
REQUEST = PlaceResearchRequest((37.61, 55.75), 2000, "джаз", START, END)


def event(**changes: Any) -> dict[str, Any]:
    return {
        "id": 1,
        "title": "Вечер джаза",
        "description": "Концерт джазового квартета",
        "dates": [{"start": int(START.timestamp()) + 3600, "end": int(START.timestamp()) + 7200}],
        "place": {"title": "Клуб", "coords": {"lon": 37.611, "lat": 55.751}},
        "site_url": "https://kudago.com/msk/event/jazz/",
        **changes,
    }


async def test_search_enriches_dates_and_venue_without_undocumented_q_parameter() -> None:
    urls = []

    def respond(request: httpx.Request) -> httpx.Response:
        urls.append(request.url)
        return httpx.Response(
            200,
            json={
                "results": [{"id": 1, "daterange": {"start": 0}}]
                if request.url.path.endswith("search/")
                else [event()]
            },
        )

    provider = PublicEvents(AsyncMock(), httpx.MockTransport(respond))
    try:
        result = await provider.research(REQUEST)
    finally:
        await provider.aclose()
    assert urls[0].params["ctype"] == "event"
    assert urls[1].params["ids"] == "1" and "q" not in urls[1].params
    assert result.records[0]["status"] == "unknown"
    assert result.records[0]["distance_m"] < 200
    assert result.records[0]["source_url"] == "https://kudago.com/msk/event/jazz/"


@pytest.mark.parametrize(
    "changes",
    [
        {"dates": [{"start": 1, "end": 2}]},
        {"place": {"id": 1}, "location": {"coords": {"lon": 37.61, "lat": 55.75}}},
        {"place": {"coords": {"lon": 39, "lat": 55}}},
        {"place": {"is_closed": True, "coords": {"lon": 37.61, "lat": 55.75}}},
        {"dates": [{"start": int(END.timestamp()), "end": int(END.timestamp()) + 3600}]},
        {"dates": [{"start": int(START.timestamp()) - 3600, "end": int(START.timestamp())}]},
        {
            "dates": [
                {"start": int(START.timestamp()), "end": int(END.timestamp()), "is_endless": True}
            ]
        },
    ],
)
async def test_unproven_dates_or_venue_never_produce_event(changes: dict[str, Any]) -> None:
    provider = PublicEvents(
        AsyncMock(),
        httpx.MockTransport(lambda r: httpx.Response(200, json={"results": [event(**changes)]})),
    )
    try:
        assert not (await provider.research(REQUEST)).records
    finally:
        await provider.aclose()


async def test_api_forbidden_is_an_honest_error() -> None:
    provider = PublicEvents(AsyncMock(), httpx.MockTransport(lambda r: httpx.Response(403)))
    try:
        with pytest.raises(ValueError, match="unavailable"):
            await provider.research(REQUEST)
    finally:
        await provider.aclose()


@pytest.mark.parametrize(
    "status,attendance,count",
    [
        ("EventScheduled", "OfflineEventAttendanceMode", 1),
        ("EventCancelled", "OfflineEventAttendanceMode", 0),
        (["EventScheduled", "EventCancelled"], "OfflineEventAttendanceMode", 0),
        ("EventPostponed", "OfflineEventAttendanceMode", 0),
        ("EventScheduled", "OnlineEventAttendanceMode", 0),
    ],
)
async def test_public_event_markup_is_parsed_without_hotel_identity(
    monkeypatch: pytest.MonkeyPatch, status: str | list[str], attendance: str, count: int
) -> None:
    record = {
        "@type": "MusicEvent",
        "name": "Вечер джаза",
        "startDate": "2026-10-27T20:00:00+03:00",
        "endDate": "2026-10-27T22:00:00+03:00",
        "eventStatus": ("https://schema.org/" + status) if isinstance(status, str) else status,
        "eventAttendanceMode": "https://schema.org/" + attendance,
        "location": {
            "@type": "Place",
            "name": "Клуб",
            "geo": {"longitude": 37.611, "latitude": 55.751},
        },
    }
    body = (
        '<html><script type="application/ld+json">'
        + json.dumps({"@graph": [record]})
        + "</script></html>"
    )
    monkeypatch.setattr("hotel_agent.adapters.external.web_research.public_url", AsyncMock())
    web = PublicWebResearch(
        httpx.MockTransport(
            lambda r: httpx.Response(200, headers={"Content-Type": "text/html"}, text=body)
        )
    )
    provider = PublicEvents(web)
    try:
        result = await provider.research(
            PlaceResearchRequest(
                REQUEST.location, 2000, start=START, end=END, url="https://example.org/events"
            )
        )
        assert len(result.records) == count
    finally:
        await provider.aclose()
        await web.aclose()


async def test_missing_timezone_preserves_day_but_not_exact_time_or_end() -> None:
    web = AsyncMock()
    web.read.return_value = WebPage(
        "https://example.org",
        "",
        "",
        START,
        (
            {
                "@type": "Event",
                "name": "Jazz",
                "startDate": "2026-10-27T20:00:00",
                "location": {"geo": {"longitude": 37.61, "latitude": 55.75}},
            },
        ),
    )
    provider = PublicEvents(web)
    try:
        result = await provider.research(
            PlaceResearchRequest(
                REQUEST.location, 1000, start=START, end=END, url="https://example.org"
            )
        )
        assert result.records[0]["start"] == "2026-10-27"
        assert result.records[0]["time_precision"] == "date"
        assert result.records[0]["end"] is None
    finally:
        await provider.aclose()


async def test_event_start_in_trip_is_usable_with_unknown_end() -> None:
    web = AsyncMock()
    web.read.return_value = WebPage(
        "https://example.org",
        "",
        "",
        START,
        (
            {
                "@type": "Event",
                "name": "Jazz concert",
                "startDate": "2026-10-27T20:00:00+03:00",
                "location": {"geo": {"longitude": 37.61, "latitude": 55.75}},
            },
        ),
    )
    provider = PublicEvents(web)
    try:
        result = await provider.research(
            PlaceResearchRequest(
                REQUEST.location, 1000, start=START, end=END, url="https://example.org"
            )
        )
        assert len(result.records) == 1
        assert result.records[0]["end"] is None
    finally:
        await provider.aclose()
