from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, DataStep
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from tests.unit.application.test_data_explorer import build, hotel


async def test_supported_quote_is_retained_with_its_actual_record() -> None:
    quote = '"amenity": "restaurant"'
    rows = [{"hotel_id": "hotel", "text": '{"amenity": "restaurant"}'}]
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=[EvidenceVerdict(record_id="0", supported=True, quote=quote)]
        )
    )

    matched = await DocumentEvidence(cast(LLMPort, llm), ("с рестораном",)).verify(
        "с рестораном", rows, [{"value": "restaurant"}]
    )

    assert matched[0]["hotel_id"] == "hotel"
    assert matched[0]["_evidence_quote"] == quote


async def test_invented_quote_cannot_confirm_a_wish() -> None:
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=[
                EvidenceVerdict(record_id="0", supported=True, quote="Номера расположены под водой")
            ]
        )
    )

    matched = await DocumentEvidence(cast(LLMPort, llm), ("под водой",)).verify(
        None, [{"hotel_id": "hotel", "text": "улица Подводников"}], [{"value": "подводн"}]
    )

    assert matched == []


async def test_street_name_does_not_prove_underwater_accommodation() -> None:
    wanted = DataCriterion(
        term="под водой",
        source_text="под водой",
        required=True,
        checks=(DataCheck(field="r1.match_count", op="gte", value=1),),
        explanation="Под водой",
    )
    explorer, llm, _ = build(
        [
            DataStep(
                action="read_records",
                arguments={
                    "dataset": "documents",
                    "term": "под водой",
                    "filters": [{"field": "text", "op": "contains", "value": "подводн"}],
                },
                criteria=(wanted,),
            ),
            DataStep(action="finish", arguments={}, criteria=(wanted,)),
            DataStep(
                action="finish",
                arguments={},
                reason="Адрес не подтверждает проживание под водой; проверенные записи не содержат такого описания.",
                irrelevant_sources=("geography", "environment"),
            ),
        ],
        rows={
            "hotels": [{"hotel_id": "city", "name": "Гостевой дом"}],
            "rooms": [],
            "facilities": [],
            "documents": [
                {
                    "hotel_id": "city",
                    "id": "osm:city",
                    "source": "OpenStreetMap",
                    "text": '{"addr:street": "улица Подводников", "tourism": "guest_house"}',
                }
            ],
        },
    )

    result = await explorer(
        "неважно где, отель под водой",
        ("под водой",),
        "Россия",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert all(row.value is None for row in result.facts)
    assert not result.resolved_terms
    llm.verify_evidence.assert_awaited_once()
