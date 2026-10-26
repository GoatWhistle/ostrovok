from collections.abc import Mapping

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.services.scoring import Scored


def search_rank(hotel: SearchHotelRecord, scored: Scored) -> tuple[float, int, bool, bool, str]:
    computed_views = 0
    for match in scored.matches:
        if match.fact is None:
            continue
        visibility = match.fact.qualifiers.get("visibility")
        if isinstance(visibility, Mapping):
            computed_views += (
                2
                if visibility.get("target_location")
                else int(visibility.get("calculation_attempted") is True)
            )
    return (
        -scored.score,
        -computed_views,
        hotel.name == hotel.id,
        hotel.name.startswith("#"),
        hotel.name.casefold(),
    )


def view_eligible(scored: Scored) -> bool:
    views: list[bool] = []
    for match in scored.matches:
        if match.fact is None or not match.fact.provenance.method.startswith("window_visibility@"):
            continue
        visibility = match.fact.qualifiers.get("visibility")
        if isinstance(visibility, Mapping):
            attempted = visibility.get("calculation_attempted") is not False
            if match.intent.required and not attempted:
                return False
            views.append(attempted)
    return not views or any(views)
