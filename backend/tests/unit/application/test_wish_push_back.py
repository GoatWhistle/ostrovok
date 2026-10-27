from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_records import WishStatus
from tests.unit.application.test_data_explorer import build, hotel

FIRST = "Записей об этом нет; буду искать в другом источнике."
SECOND = "Источники об этом молчат; погода и рельеф к пожеланию не относятся."


async def test_an_unproven_finish_is_pushed_back_once_and_then_accepted() -> None:
    explorer, llm, _ = build([])
    steps = [
        DataStep(action="match_records", arguments={"dataset": "hotels"}),
        DataStep(action="finish", arguments={}, reason=FIRST),
        DataStep(action="finish", arguments={}, reason=SECOND),
        DataStep(action="finish", arguments={}, reason="Третья попытка не должна понадобиться."),
    ]
    llm.explore_data = AsyncMock(side_effect=steps)

    outcome = await explorer(
        "отель, где жил поэт",
        ("где жил поэт",),
        "Петербург",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert llm.explore_data.await_count == 3
    assert outcome.wish_results[0].status is WishStatus.INCOMPLETE
    assert outcome.wish_results[0].reason == SECOND
