from datetime import datetime
from typing import Any

from hotel_agent.application.agent.place_tools import PlaceTools
from hotel_agent.application.agent.research_tools import ResearchTools


async def search_events(
    places: PlaceTools, research: ResearchTools, city: str, arguments: dict[str, Any], now: datetime
) -> dict[str, Any]:
    dated = bool(arguments.get("check_in") and arguments.get("check_out"))
    result: dict[str, Any] = {}
    if dated:
        result = await places.execute(
            "read_event_page" if arguments.get("url") else "search_events", arguments
        )
        if result.get("fields") or any(
            row.get("records") for row in result.get("measurements", [])
        ):
            return result
    query = str(arguments.get("query") or arguments.get("term") or "афиша мероприятий")
    if len(query) > 300:
        raise ValueError("Research query must not exceed 300 characters")
    search = await places.discover(query, city)
    if not search.get("hits"):
        search = await research.execute("search_web", {"query": f"{query} {city} {now.year}"})
    return {
        **result,
        **search,
        "discovery_only": True,
        "note": "Event discovery, not a hotel match. Read relevant pages without hotel_id to establish the event date, city and venue. Prefer organizer or ticket seller. Then use read_event_page with sourced dates to measure proximity. If several occurrences are possible ask which one. Do not invent stay dates, coordinates or claim unavailable listings mean no event.",
    }
