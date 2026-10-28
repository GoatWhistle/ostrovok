from dataclasses import replace
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.ports.walk import PlaceWalk
from hotel_agent.application.search_selection import Candidate
from hotel_agent.domain.query import NearbyObjectRequest, ParsedQuery
from tests.unit.application.test_city_search import search


@pytest.mark.parametrize(
    "key,value,name",
    [
        ("amenity", "bar", ""),
        ("amenity", "pharmacy", ""),
        ("shop", "supermarket", ""),
        ("name", "*", "площадь"),
        ("name", "*", "набережная"),
    ],
)
async def test_nearest_hotel_is_reviewed_before_count_based_cutoff(
    key: str, value: str, name: str
) -> None:
    request = NearbyObjectRequest(
        osm_key=key,
        osm_value=value,
        name=name,
        open_24h=False,
        radius_m=500,
        source_text="near bars",
    )
    parsed = ParsedQuery(
        intents=(), unmatched_terms=(), location_hint="Москва", nearby_objects=(request,)
    )
    use_case, _, repository, scope = search(parsed, (37.4, 55.5, 37.9, 56.0))
    base = repository.list_hotels.return_value[0]
    hotels = [replace(base, id=f"far{i}") for i in range(25)] + [replace(base, id="near")]
    repository.list_hotels.return_value = hotels
    repository.save_facts = AsyncMock()
    entered = scope.__aenter__.return_value
    entered.commit = AsyncMock()
    entered.nearby_objects.list_matches = AsyncMock(
        return_value={h.id: ("n1",) if h.id == "near" else ("n1", "n2", "n3") for h in hotels}
    )

    async def routes(origin: str, targets: list[str], max_m: float) -> tuple[PlaceWalk, ...]:
        return (
            PlaceWalk(
                hotel_id=origin,
                place_id="n1",
                meters=10 if origin == "near" else 100,
                minutes=1,
                mode="graph",
                geometry={"type": "LineString"},
            ),
        )

    entered.walk = SimpleNamespace(
        routes=AsyncMock(side_effect=routes), in_buildings=AsyncMock(return_value=())
    )

    async def check(
        query: str, understood: ParsedQuery, candidates: list[Candidate], limit: int
    ) -> ReviewResult:
        return ReviewResult(accepted_ids=tuple(h.id for h, _ in candidates[:limit]))

    use_case._review = cast(
        RecommendationReview, SimpleNamespace(check=AsyncMock(side_effect=check))
    )
    result = await use_case("near bars in Moscow", "russia", None, 20)
    assert result.results[0].hotel.id == "near"
