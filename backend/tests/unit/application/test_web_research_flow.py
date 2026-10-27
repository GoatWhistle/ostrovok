import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from tests.unit.application.test_data_explorer import NOW, build, hotel


async def test_discovered_page_can_be_bound_and_verified_without_refetch_or_finish() -> None:
    term = "с обсерваторией"
    quote = "The old Harbor hotel has an observatory for its guests."
    url = "https://example.org/history"
    explorer, llm, _ = build(
        [
            DataStep(action="read_web_page", arguments={"url": url}),
            DataStep(action="list_candidates", arguments={"query": "Harbor"}),
            DataStep(action="read_web_page", arguments={"url": url, "hotel_id": "city"}),
        ],
        rows={"hotels": [{"hotel_id": "city", "tags": {"old_name": "Harbor"}}]},
    )
    provider = SimpleNamespace(
        read=AsyncMock(return_value=WebPage(url, "History", "Navigation " * 1200 + quote, NOW))
    )
    explorer._web = cast(WebResearchPort, provider)

    async def verify(context: str) -> list[EvidenceVerdict]:
        payload = json.loads(context)
        row = payload["records"][0]
        assert row["hotel_identity"]["tags"]["old_name"] == "Harbor"
        assert quote in row["source_text"]
        return [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    llm.verify_evidence.side_effect = verify
    result = await explorer(
        "отель с обсерваторией", (term,), "Город", "russia", [hotel("city")], None, False
    )

    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.facts[0].qualifiers["source_quotes"] == [quote]
    assert result.facts[0].qualifiers["source_urls"] == [url]
    provider.read.assert_awaited_once_with(url)
    assert llm.explore_data.await_count == 3


async def test_verified_paraphrased_wish_is_not_lost_to_literal_query_guard() -> None:
    term = "историческая башня"
    quote = "The hotel occupies a historic tower built in 1900."
    explorer, llm, _ = build(
        [DataStep(action="match_records", arguments={"dataset": "documents"})],
        rows={"documents": [{"hotel_id": "city", "text": quote}]},
    )
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
    result = await explorer(
        "Хочу отель в исторической башне", (term,), "Город", "russia", [hotel("city")], None, False
    )
    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.facts[0].value is True


async def test_wishes_explored_together_read_a_shared_source_once() -> None:
    url = "https://example.org/history"
    quote = "The historic tower hotel also has an observatory for guests."
    step = DataStep(action="read_web_page", arguments={"url": url, "hotel_id": "city"})
    explorer, llm, _ = build([step, step])
    provider = SimpleNamespace(read=AsyncMock(return_value=WebPage(url, "Hotel", quote, NOW)))
    explorer._web = cast(WebResearchPort, provider)
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
    result = await explorer(
        "отель в исторической башне с обсерваторией",
        ("в исторической башне", "с обсерваторией"),
        "Город",
        "russia",
        [hotel("city")],
        None,
        False,
    )
    assert all(wish.status is WishStatus.MATCHED for wish in result.wish_results)
    assert llm.verify_evidence.await_count == 2
    provider.read.assert_awaited_once_with(url)


async def test_verified_page_fact_carries_catalogue_identity_for_the_final_review() -> None:
    term = "где жил поэт"
    quote = "В этой гостинице «Ритц-Карлтон» в 1925 году жил поэт."
    url = "https://example.org/history"
    explorer, llm, _ = build(
        [
            DataStep(action="read_web_page", arguments={"url": url, "hotel_id": "city"}),
        ],
        rows={
            "hotels": [
                {
                    "hotel_id": "city",
                    "name": "The Carlton",
                    "tags": {"wikipedia": "ru:Ритц-Карлтон Москва", "building:levels": "11"},
                }
            ]
        },
    )
    provider = SimpleNamespace(
        read=AsyncMock(return_value=WebPage(url, "История", "Текст. " * 200 + quote, NOW))
    )
    explorer._web = cast(WebResearchPort, provider)
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    result = await explorer(
        "гостиница, где жил поэт", (term,), "Москва", "russia", [hotel("city")], None, False
    )

    assert quote[:300] in result.facts[0].explanation
    identity = result.facts[0].qualifiers["catalogue_identity"]
    assert "wikipedia=ru:Ритц-Карлтон Москва" in identity
    assert "name=The Carlton" in identity
    assert not any("building:levels" in row for row in identity)
