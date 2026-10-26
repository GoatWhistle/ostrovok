from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.agent.semantic_review import ReviewResult, SemanticReview
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.landmark_resolution import LandmarkResolver
from hotel_agent.domain.query import SpatialRequest


@pytest.mark.parametrize("accepted", [("museum",), (), ("museum", "pavilion")])
async def test_identity_review_overrides_exact_name_and_preserves_ambiguity(
    accepted: tuple[str, ...],
) -> None:
    museum = NamedPlaceRecord(
        id="museum",
        name="Государственный Эрмитаж",
        location=(30.31, 59.94),
        tags={"wikidata": "Q132783"},
    )
    pavilion = NamedPlaceRecord(
        id="pavilion", name="Эрмитаж", location=(29.9, 59.88), tags={"wikidata": "QOther"}
    )
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.named_places.candidates = AsyncMock(return_value=(pavilion, museum))
    review = MagicMock(spec=SemanticReview)

    async def check(*args: object) -> ReviewResult:
        uow.__aexit__.assert_awaited_once()
        return ReviewResult(accepted_ids=accepted)

    review.check = AsyncMock(side_effect=check)
    resolver = LandmarkResolver(lambda: uow, review)
    request = SpatialRequest(
        kind="landmark_view", target="Эрмитаж", radius_m=2000, source_text="вид на Эрмитаж"
    )
    result = await resolver(request, "Санкт-Петербург", (29, 59, 31, 61), pavilion)
    assert result.place == (museum if accepted == ("museum",) else None)
    assert result.ambiguous == (accepted != ("museum",))
    assert await resolver(request, "Санкт-Петербург", (29, 59, 31, 61), pavilion) == result
    review.check.assert_awaited_once()
