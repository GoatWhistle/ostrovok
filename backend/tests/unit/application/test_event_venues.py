import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.application.agent.event_venues import EventVenueResearch
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_research import PlaceResearchRequest
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort

START = datetime(2026, 11, 22, tzinfo=UTC)
SOURCE = WebPage(
    "https://venue.example/concert", "Concert", "Band at Live Hall, Moscow, November 22", START
)
EVENT = {
    "@type": "MusicEvent",
    "name": "Band concert",
    "startDate": "2026-11-22T20:00:00",
    "eventStatus": "https://schema.org/EventScheduled",
    "location": {"name": "Live Hall", "address": "Moscow"},
}
VENUE = NamedPlaceRecord(
    id="n42", name="Live Hall", location=(37.69, 55.75), tags={"amenity": "music_venue"}
)
REQUEST = PlaceResearchRequest(
    (37.691, 55.751), 2000, "Band concert", START, datetime(2026, 11, 23, tzinfo=UTC), SOURCE.url
)


@pytest.mark.parametrize("supported", [True, False])
async def test_unstructured_official_page_finds_event_and_resolves_venue(supported: bool) -> None:
    listing = replace(SOURCE, url="https://tickets.example/concert", events=(EVENT,))
    web = SimpleNamespace(
        search=AsyncMock(return_value=[listing]), read=AsyncMock(side_effect=[SOURCE, listing])
    )
    repository = SimpleNamespace(candidates=AsyncMock(return_value=[VENUE]))

    @asynccontextmanager
    async def uow() -> AsyncIterator[Any]:
        yield SimpleNamespace(named_places=repository)

    async def verify(context: str) -> list[EvidenceVerdict]:
        records = json.loads(context)["records"]
        return [
            EvidenceVerdict(record_id=r["record_id"], supported=supported, quote=r["source_text"])
            for r in records
        ]

    llm = SimpleNamespace(verify_evidence=AsyncMock(side_effect=verify))
    provider = PublicEvents(cast(WebResearchPort, web))
    try:
        research = EventVenueResearch(
            provider,
            cast(WebResearchPort, web),
            cast(UnitOfWorkFactory, uow),
            cast(LLMPort, llm),
            "Moscow",
            (37.5, 55.6, 37.9, 55.9),
        )
        result = await research.research(REQUEST)
        assert bool(result.records) is supported
        if supported:
            assert result.records[0]["location"] == VENUE.location
            assert result.records[0]["start"] == "2026-11-22"
            assert result.records[0]["time_precision"] == "date"
            assert result.records[0]["source_url"] == listing.url
        assert llm.verify_evidence.await_count == 1
    finally:
        await provider.aclose()


async def test_unzoned_event_does_not_confirm_an_hour_specific_request() -> None:
    web = SimpleNamespace(
        read=AsyncMock(
            return_value=replace(
                SOURCE,
                events=({**EVENT, "location": {"geo": {"longitude": 37.69, "latitude": 55.75}}},),
            )
        )
    )
    provider = PublicEvents(cast(WebResearchPort, web))
    try:
        result = await provider.research(
            replace(REQUEST, start=START.replace(hour=19), end=START.replace(hour=22))
        )
        assert not result.records
    finally:
        await provider.aclose()
