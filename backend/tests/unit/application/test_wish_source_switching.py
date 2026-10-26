import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.hotel_catalog import CatalogHotel, HotelCatalogSource
from hotel_agent.application.ports.semantic_search import SearchDocument, SemanticSearchPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from tests.unit.application.test_data_explorer import build, hotel

CASES = (
    ("тихо спать", "Soundproof rooms facing a quiet courtyard."),
    ("можно с собакой", "Pets are welcome in designated rooms."),
    ("можно с кошкой", "Cats are accepted without an additional fee."),
    ("с рестораном", "The hotel operates an on-site restaurant."),
    ("без ступенек", "Step-free access from the entrance to the room."),
    ("для работы ночью", "A private desk and reliable Wi-Fi are available all night."),
    ("детская кроватка", "Baby cots are available in family rooms."),
    ("зарядить электромобиль", "Guests can use the electric vehicle charging station."),
    ("без запаха табака", "Smoking is prohibited throughout the property."),
    ("завтрак в номер", "Breakfast can be delivered to your room."),
    ("с пианино", "A piano is available for guests in the music room."),
    ("телескоп на крыше", "The rooftop observatory offers a telescope for guests."),
    ("велосипед в номер", "Guests may store bicycles inside their rooms."),
    ("баня с веником", "The Russian steam bath includes birch whisk treatments."),
    ("без телевизора", "These rooms do not contain a television."),
    ("аллергия на перо", "Hypoallergenic pillows contain no feathers."),
    ("свой причал", "The property has a private pier for hotel guests."),
    ("готовить самому", "Each apartment includes a fully equipped private kitchen."),
    ("кровать два метра", "The bed length is 200 centimetres."),
    ("стирка ночью", "The self-service laundry operates 24 hours a day."),
)


@pytest.mark.parametrize(("wish", "quote"), CASES)
async def test_each_wish_can_switch_from_unhelpful_embeddings_to_provider_content(
    wish: str,
    quote: str,
) -> None:
    explorer, llm, _ = build(
        [
            DataStep(action="search_documents", arguments={"query": wish}),
            DataStep(action="match_records", arguments={"dataset": "retrieved_documents"}),
            DataStep(action="get_provider_content", arguments={"hotel_ids": ["city"]}),
            DataStep(action="match_records", arguments={"dataset": "provider_hotels"}),
        ]
    )
    semantic = SimpleNamespace(
        search=AsyncMock(
            return_value=[
                SearchDocument(
                    id="doc",
                    hotel_id="city",
                    text="A hotel at a central address.",
                    source="catalog",
                )
            ]
        )
    )
    provider = SimpleNamespace(
        get_hotel=AsyncMock(
            return_value=CatalogHotel(
                "supplier",
                "city",
                (),
                details={"description": quote},
            )
        )
    )
    explorer._semantic = cast(SemanticSearchPort, semantic)
    explorer._catalog = cast(HotelCatalogSource, provider)

    async def verify(context: str) -> list[EvidenceVerdict]:
        request = json.loads(context)
        assert request["wish"] == wish
        assert request["request"] == f"Отель в Сочи: {wish}"
        return [
            EvidenceVerdict(record_id=row["record_id"], supported=True, quote=quote)
            for row in request["records"]
            if quote in row["source_text"]
        ]

    llm.verify_evidence.side_effect = verify
    result = await explorer(
        f"Отель в Сочи: {wish}", (wish,), "Сочи", "sochi", [hotel("city")], None, False
    )

    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.wish_results[0].tool_calls == 4
    assert result.wish_results[0].checked_sources == ("embeddings", "provider")
    assert result.facts[0].value is True
    assert result.facts[0].qualifiers["source_quotes"] == [quote]
    assert (
        result.facts[0].source_id == "https://api.liteapi.travel/v3.0/data/hotel?hotelId=supplier"
    )
    semantic.search.assert_awaited_once_with(wish, ("city",), 12)
    provider.get_hotel.assert_awaited_once_with("supplier")


async def test_seven_tool_calls_can_find_evidence_after_six_distinct_retrieval_attempts() -> None:
    quote = "The private observatory has a telescope for guests."
    explorer, llm, _ = build(
        [
            *(
                DataStep(action="search_documents", arguments={"query": f"observatory {i}"})
                for i in range(6)
            ),
            DataStep(action="match_records", arguments={"dataset": "retrieved_documents"}),
        ]
    )
    semantic = SimpleNamespace(
        search=AsyncMock(
            side_effect=[
                *([] for _ in range(5)),
                [SearchDocument(id="telescope", hotel_id="city", text=quote, source="catalog")],
            ]
        )
    )
    explorer._semantic = cast(SemanticSearchPort, semantic)
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    result = await explorer(
        "отель с телескопом", ("с телескопом",), "Сочи", "sochi", [hotel("city")], None, False
    )

    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.wish_results[0].tool_calls == 7
    assert semantic.search.await_count == 6
