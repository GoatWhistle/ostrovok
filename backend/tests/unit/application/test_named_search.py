from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from tests.unit.application.test_data_explorer import NOW, build, hotel


async def test_a_hotel_scoped_web_search_carries_the_catalogue_names() -> None:
    asked: list[str] = []

    async def search(query: str) -> list[WebPage]:
        asked.append(query)
        return [WebPage("https://example.org/a", "A", "text", NOW)]

    explorer, llm, _ = build(
        [
            DataStep(action="search_web", arguments={"query": "Трамп", "hotel_id": "city"}),
            *[
                DataStep(action="finish", arguments={}, reason=f"Источники молчат, попытка {n}.")
                for n in range(4)
            ],
        ],
        rows={
            "hotels": [
                {
                    "hotel_id": "city",
                    "name": "The Carlton Moscow",
                    "tags": {"wikipedia": "ru:Ритц-Карлтон Москва"},
                }
            ]
        },
    )
    explorer._web = cast(
        WebResearchPort, SimpleNamespace(search=search, read=AsyncMock(side_effect=ValueError()))
    )

    await explorer(
        "отель, где останавливался Трамп",
        ("где останавливался Трамп",),
        "Москва",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert asked[0] == 'Трамп "The Carlton Moscow" "Ритц-Карлтон Москва"'
