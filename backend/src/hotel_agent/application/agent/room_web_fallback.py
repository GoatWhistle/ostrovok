from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.agent.research_tools import ResearchTools
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.errors import ModelFailure


class RoomWebFallback:
    def __init__(
        self,
        research: ResearchTools,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        city: str,
        enabled: bool,
    ) -> None:
        self._research, self._hotels, self._city, self._enabled = research, hotels, city, enabled
        self._results: dict[str, dict[str, Any]] = {}

    async def search(self, hotel_ids: Sequence[str]) -> dict[str, Any]:
        if not hotel_ids:
            return {}
        if not self._enabled:
            return {
                "web_fallback": {"unavailable": True, "reason": "Web research is not configured"}
            }
        results = []
        for hotel in self._hotels():
            if hotel.id not in hotel_ids:
                continue
            if hotel.id not in self._results:
                query = f'"{hotel.name}" {self._city} {hotel.address or ""} номера категории оснащение официальный сайт'
                try:
                    found = await self._research.execute("search_web", {"query": query})
                except (ValueError, ModelFailure) as error:
                    found = {"unavailable": True, "error": str(error)}
                self._results[hotel.id] = {"hotel_id": hotel.id, "query": query, **found}
            results.append(self._results[hotel.id])
        return {
            "web_room_searches": results,
            "checked_sources": ["web"] if any(not row.get("error") for row in results) else [],
            "web_fallback_note": "Provider has no room information. Read relevant official pages with read_web_page and the associated hotel_id. Search snippets are not evidence. Web descriptions do not prove dated availability.",
        }
