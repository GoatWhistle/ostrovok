from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_evidence import wish_key
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from tests.unit.application.test_data_explorer import NOW, build, hotel


async def test_a_fact_from_a_page_carries_its_title_for_the_final_review() -> None:
    url = "https://example.org/moscow-2013"
    quote = "He stayed overnight at the Ritz during the Moscow pageant."
    explorer, llm, _ = build(
        [DataStep(action="read_web_page", arguments={"url": url, "hotel_id": "city"})]
    )
    page = WebPage(url, "Trump in Moscow, November 2013", "Текст. " * 200 + quote, NOW)
    explorer._web = cast(WebResearchPort, SimpleNamespace(read=AsyncMock(return_value=page)))
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    outcome = await explorer(
        "отель, где останавливался Трамп",
        ("где останавливался Трамп",),
        "Москва",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    fact = next(
        row
        for row in outcome.facts
        if row.characteristic_key == wish_key("где останавливался Трамп")
    )
    assert fact.qualifiers["source_titles"] == ["Trump in Moscow, November 2013"]
    assert fact.qualifiers["source_quotes"] == [quote]
