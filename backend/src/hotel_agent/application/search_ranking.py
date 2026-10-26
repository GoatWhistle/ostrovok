from collections.abc import Mapping

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.services.scoring import Scored


def search_rank(hotel: SearchHotelRecord, scored: Scored) -> tuple[float, int, bool, bool, str]:
    computed_views = 0
    for match in scored.matches:
        if match.fact is None:
            continue
        visibility = match.fact.qualifiers.get("visibility")
        if isinstance(visibility, Mapping) and visibility.get("target_location"):
            computed_views += 1
    return (
        -scored.score,
        -computed_views,
        hotel.name == hotel.id,
        hotel.name.startswith("#"),
        hotel.name.casefold(),
    )
