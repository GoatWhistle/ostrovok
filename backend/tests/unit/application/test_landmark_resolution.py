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


async def test_single_lexical_candidate_requires_semantic_confirmation() -> None:
    candidate = NamedPlaceRecord(
        id="tower", name="Останкинская телевизионная башня", location=(37.61, 55.82)
    )
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.named_places.candidates = AsyncMock(return_value=(candidate,))
    review = MagicMock(spec=SemanticReview)
    review.check = AsyncMock(return_value=ReviewResult(accepted_ids=()))
    request = SpatialRequest(
        kind="landmark_view",
        target="Останкинская телебашня",
        radius_m=10000,
        source_text="вид на Останкинскую телебашню",
    )
    result = await LandmarkResolver(lambda: uow, review)(request, "Москва", (37, 55, 38, 56), None)
    assert result.place is None
    review.check.assert_awaited_once()


async def test_an_object_found_outside_the_city_still_reaches_the_review() -> None:
    lake = NamedPlaceRecord(
        id="r1308279",
        name="Онежское озеро",
        location=(35.0277084, 62.1861201),
        tags={"wikidata": "Q179732"},
    )
    inside = [
        NamedPlaceRecord(id="n1", name="Долгое озеро", location=(34.3, 61.8), tags={}),
        NamedPlaceRecord(id="n2", name="озеро Угольная Ламба", location=(34.4, 61.8), tags={}),
    ]
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.named_places.candidates = AsyncMock(return_value=tuple(inside))
    review = MagicMock(spec=SemanticReview)
    seen: list[tuple[str, ...]] = []

    async def check(query: str, mode: str, claims: object) -> ReviewResult:
        assert isinstance(claims, tuple)
        seen.append(tuple(claim.id for claim in claims))
        return ReviewResult(accepted_ids=("r1308279",))

    review.check = AsyncMock(side_effect=check)
    resolver = LandmarkResolver(lambda: uow, review)
    request = SpatialRequest(
        kind="landmark_view",
        target="Онежское озеро",
        radius_m=5000,
        source_text="вид на Онежское озеро",
    )

    result = await resolver(request, "Петрозаводск", (34.18, 61.70, 34.54, 61.86), lake)

    assert seen == [("n1", "n2", "r1308279")]
    assert result.place == lake
    assert result.ambiguous is False
