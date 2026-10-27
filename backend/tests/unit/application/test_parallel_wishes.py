import asyncio
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from tests.unit.application.test_data_explorer import build, hotel


async def test_wishes_are_explored_at_the_same_time() -> None:
    active = 0
    peak = 0

    async def plan(context: str) -> DataStep:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        return DataStep(
            action="finish", arguments={}, reason="Источники не подтверждают пожелание."
        )

    explorer, llm, _ = build([])
    llm.explore_data = AsyncMock(side_effect=plan)
    outcome = await explorer(
        "отель у воды и с видом",
        ("у воды", "с видом"),
        "Город",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert peak == 2
    assert len(outcome.wish_results) == 2


async def test_an_expanded_area_from_any_wish_widens_the_result() -> None:
    explorer, llm, _ = build([])
    llm.explore_data = AsyncMock(
        side_effect=lambda context: DataStep(
            action="finish", arguments={}, reason="Источники не подтверждают пожелание."
        )
    )
    outcome = await explorer(
        "отель у воды",
        ("у воды",),
        "Город",
        "russia",
        [hotel("city")],
        (10.0, 20.0, 11.0, 21.0),
        False,
    )

    assert outcome.bbox == (10.0, 20.0, 11.0, 21.0)
