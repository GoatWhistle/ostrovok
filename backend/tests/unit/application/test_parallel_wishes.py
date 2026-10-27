import asyncio
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.explore_data import WISHES_AT_ONCE
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from tests.unit.application.test_data_explorer import NOW, build, hotel


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


async def test_a_later_wish_starts_from_pages_the_others_already_read() -> None:
    url = "https://example.org/history"
    quote = "The historic tower hotel also has an observatory for guests."
    step = DataStep(action="read_web_page", arguments={"url": url, "hotel_id": "city"})
    explorer, llm, _ = build([step] * 4)
    provider = SimpleNamespace(read=AsyncMock(return_value=WebPage(url, "Hotel", quote, NOW)))
    explorer._web = cast(WebResearchPort, provider)
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    outcome = await explorer(
        "отель в башне с обсерваторией у реки и в тишине",
        ("в башне", "с обсерваторией", "у реки", "в тишине"),
        "Город",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert len(outcome.wish_results) == 4
    assert llm.explore_data.await_count == WISHES_AT_ONCE
