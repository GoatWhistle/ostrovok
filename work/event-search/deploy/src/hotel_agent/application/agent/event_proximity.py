from collections.abc import Sequence
from dataclasses import replace
from datetime import datetime

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.place_research import (
    PlaceResearchPort,
    PlaceResearchRequest,
    PlaceResearchResult,
)
from hotel_agent.application.spatial_matching import distance_m


async def event_proximity(
    provider: PlaceResearchPort,
    hotels: Sequence[SearchHotelRecord],
    radius: float,
    query: str,
    start: datetime | None,
    end: datetime | None,
    url: str,
) -> list[PlaceResearchResult | BaseException]:
    if not hotels:
        return []
    center = hotels[0].location
    coverage = max(distance_m(center, h.location) for h in hotels) + radius
    try:
        found = await provider.research(
            PlaceResearchRequest(center, coverage, query, start, end, url)
        )
    except (ValueError, TypeError, KeyError) as error:
        return [error for _ in hotels]
    return [
        replace(
            found,
            records=tuple(
                {**record, "distance_m": round(distance, 1)}
                for record in found.records
                if (distance := distance_m(hotel.location, record["location"])) <= radius
            ),
        )
        for hotel in hotels
    ]
