from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_loop import STALL_LIMIT
from hotel_agent.application.agent.wish_records import WishStatus
from tests.unit.application.test_data_explorer import build, hotel


async def test_a_wish_that_establishes_nothing_stops_before_its_step_limit() -> None:
    explorer, llm, _ = build([])
    asked = 0

    async def plan(context: str) -> DataStep:
        nonlocal asked
        asked += 1
        return DataStep(action="read_records", arguments={"dataset": "rooms", "page": asked})

    llm.explore_data = AsyncMock(side_effect=plan)

    outcome = await explorer(
        "отель с видом на горы", ("вид на горы",), "Сочи", "russia", [hotel("city")], None, False
    )

    assert llm.explore_data.await_count == STALL_LIMIT
    assert outcome.wish_results[0].status is WishStatus.INCOMPLETE
    assert "ничего нового" in outcome.wish_results[0].reason
