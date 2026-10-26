from unittest.mock import AsyncMock

import httpx

from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.application.ports.place_research import PlaceResearchRequest


async def test_event_discovery_uses_public_search_form_without_stay_dates() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        assert request.url.params["city"] == "moscow"
        assert request.url.params["search-text"] == "Кишлак"
        return httpx.Response(
            200,
            text='<a href="/moscow/concert/example?source=search">Кишлак date and venue</a><a href="/saint-petersburg/concert/other">Other city</a><a href="https://elsewhere.example/moscow/concert/example">Outside</a>',
        )

    provider = PublicEvents(AsyncMock(), httpx.MockTransport(handle))
    try:
        result = await provider.research(
            PlaceResearchRequest((37.6, 55.7), 20000, "Кишлак концерт Москва 2026", city="Москва")
        )
        assert len(result.records) == 1
        assert result.records[0]["url"] == "https://afisha.yandex.ru/moscow/concert/example"
        assert "location" not in result.records[0]
        assert not result.values
    finally:
        await provider.aclose()
