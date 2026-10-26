import json
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_records import DataCheck, DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.measurement_scope import verify_measurement_scope
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict


async def test_scope_rejection_cannot_become_a_verified_current_sun_fact() -> None:
    criterion = DataCriterion(
        term="солнце сейчас",
        source_text="солнце сейчас",
        checks=(DataCheck(field="env1.daylight", op="gte", value=1),),
        required=False,
        explanation="",
    )
    tools = DataTools(MagicMock(), MagicMock(), [], "Мурманск", "russia", None, False)
    tools.descriptions["env1.daylight"] = "Солнце над горизонтом, 2026-10-26T12:00:00+03:00"
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=[]))
    now = datetime(2026, 10, 26, 1, tzinfo=UTC)
    accepted, rejected = await verify_measurement_scope(
        cast(LLMPort, llm), "хочу солнце сейчас", (criterion,), tools, now
    )
    assert accepted == ()
    assert rejected == ("солнце сейчас",)
    context = json.loads(llm.verify_evidence.call_args.args[0])
    assert context["now"] == now.isoformat()
    assert "12:00:00" in context["records"][0]["source_text"]


async def test_scope_acceptance_requires_a_verbatim_quote_from_real_measurements() -> None:
    criterion = DataCriterion(
        term="теплее 20",
        source_text="теплее 20",
        checks=(DataCheck(field="env1.temperature_c", op="gte", value=20),),
        required=False,
        explanation="",
    )
    tools = DataTools(MagicMock(), MagicMock(), [], "Сочи", "russia", None, False)
    description = "Температура, 2026-10-28T12:00:00+03:00"
    tools.descriptions["env1.temperature_c"] = description
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=[
                EvidenceVerdict(
                    record_id="0", supported=True, quote="made up quote that was not in the source"
                )
            ]
        )
    )
    accepted, _ = await verify_measurement_scope(
        cast(LLMPort, llm), "теплее 20", (criterion,), tools, datetime.now(UTC)
    )
    assert not accepted
    llm.verify_evidence.return_value = [
        EvidenceVerdict(record_id="0", supported=True, quote=description)
    ]
    accepted, rejected = await verify_measurement_scope(
        cast(LLMPort, llm), "теплее 20", (criterion,), tools, datetime.now(UTC)
    )
    assert accepted == (criterion,)
    assert rejected == ()


async def test_capacity_filter_cannot_establish_a_room_floor_wish() -> None:
    tools = DataTools(MagicMock(), MagicMock(), [], "Сочи", "sochi", None, False)
    tools.descriptions["r1.match_count"] = "Подтверждений в данных источника"
    tools.reader.field_context["r1.match_count"] = (
        '{"dataset":"rooms","filters":[{"field":"capacity","op":"eq","value":2}]}'
    )
    wanted = DataCriterion(
        term="на 17 этаже",
        source_text="на 17 этаже",
        required=False,
        checks=(DataCheck(field="r1.match_count", op="gte", value=1),),
        explanation="",
    )
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=[]))
    accepted, rejected = await verify_measurement_scope(
        cast(LLMPort, llm), "номер на 17 этаже", (wanted,), tools, datetime.now(UTC)
    )
    assert accepted == ()
    assert rejected == ("на 17 этаже",)
    context = json.loads(llm.verify_evidence.await_args.args[0])
    assert "capacity" in context["records"][0]["source_text"]
