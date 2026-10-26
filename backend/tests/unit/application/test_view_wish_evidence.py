from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.adapters.geo.window_reports import window_evidence
from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.requested_evidence import (
    RequestedEvidence,
    RequestedEvidencePort,
)
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, SpatialRequest
from tests.unit.application.test_data_explorer import NOW, build, hotel


@pytest.mark.parametrize("rejected", [False, True])
async def test_web_quote_cannot_replace_unknown_window_geometry(rejected: bool) -> None:
    term = "с видом на море с первого этажа"
    quote = "Номер на первом этаже с видом на море."
    request = SpatialRequest(
        kind="sea_view", target=None, radius_m=10000, source_text=term, floor_min=1, floor_max=1
    )
    fact, _ = window_evidence(
        "city", request, NOW, None, "Неизвестны высоты препятствий", rejected=rejected
    )
    intent = Intent(
        characteristic_key=fact.characteristic_key,
        op=Op.EQ,
        value=True,
        weight=1,
        required=False,
        source_text=term,
    )
    native = cast(
        RequestedEvidencePort,
        SimpleNamespace(
            check=AsyncMock(return_value=RequestedEvidence(intents=(intent,), facts=(fact,)))
        ),
    )
    explorer, llm, _ = build(
        [
            DataStep(action="read_records", arguments={"dataset": "documents"}),
            DataStep(action="match_records", arguments={"dataset": "documents"}),
            DataStep(action="finish", arguments={}, question="Уточнить высоты зданий у отеля?"),
        ],
        rows={"documents": [{"hotel_id": "city", "text": quote}]},
    )
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
    result = await explorer(
        "Отель " + term, (term,), "Сочи", "sochi", [hotel("city")], None, False, native=native
    )
    assert result.wish_results[0].status is not WishStatus.MATCHED
    assert all(row.value is not True for row in result.facts)
    assert result.facts[0].method == "window_visibility@1"
