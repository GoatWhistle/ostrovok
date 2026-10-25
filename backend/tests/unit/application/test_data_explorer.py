import json
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, DataStep
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.data_exploration import TerrainMeasurementPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import ModelFailure
from hotel_agent.domain.services.scoring import MatchQuality, score

NOW = datetime(2026, 10, 25, tzinfo=UTC)
QUERY = "хочу отель высоко в горах около Владикавказа"


def hotel(identifier: str) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=identifier,
        region_id="russia",
        name=identifier,
        location=(44.6, 43.0),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def criterion(field: str = "m1.elevation_m") -> DataCriterion:
    return DataCriterion(
        term="высоко в горах",
        source_text="высоко в горах",
        required=False,
        explanation="Оценка: высота не менее 900 м и перепад не менее 200 м.",
        checks=(
            DataCheck(field=field, op="gte", value=900),
            DataCheck(field="m1.relief_m", op="gte", value=200),
        ),
    )


def build(
    steps: Sequence[DataStep | Exception],
    *,
    readings: dict[str, dict[str, float]] | None = None,
    rows: dict[str, list[dict[str, Any]]] | None = None,
) -> tuple[DataExplorer, SimpleNamespace, SimpleNamespace]:
    state = SimpleNamespace(active=False)
    llm = SimpleNamespace(
        explore_data=AsyncMock(side_effect=steps), verify_evidence=AsyncMock(return_value=[])
    )
    records = rows or {
        "hotels": [{"hotel_id": "city", "name": "city"}],
        "rooms": [],
        "facilities": [],
    }
    repo = SimpleNamespace(
        records=AsyncMock(side_effect=lambda dataset, _: records.get(dataset, []))
    )
    search = SimpleNamespace(
        list_hotels=AsyncMock(return_value=[hotel("city"), hotel("mountain"), hotel("plateau")])
    )

    @asynccontextmanager
    async def uow() -> AsyncIterator[SimpleNamespace]:
        state.active = True
        try:
            yield SimpleNamespace(
                data=repo,
                search=search,
                regions=SimpleNamespace(city_center=AsyncMock(return_value=(44.6, 43.0))),
            )
        finally:
            state.active = False

    async def measure(locations: object, radius: float) -> dict[str, dict[str, float]]:
        assert not state.active
        return readings or {}

    terrain = SimpleNamespace(measure=AsyncMock(side_effect=measure))
    explorer = DataExplorer(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, uow),
        cast(TerrainMeasurementPort, terrain),
        cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
        MagicMock(),
    )
    return explorer, llm, terrain


async def test_agent_explores_data_and_distinguishes_mountains_from_high_plateau() -> None:
    steps = [
        DataStep(action="inspect_data", arguments={}),
        DataStep(action="find_hotels", arguments={"radius_m": 30000}),
        DataStep(action="measure_terrain", arguments={"radius_m": 1000}),
        DataStep(action="finish", arguments={}, criteria=(criterion(),)),
    ]
    explorer, llm, terrain = build(
        steps,
        readings={
            "city": {"elevation_m": 650, "relief_m": 20},
            "mountain": {"elevation_m": 1500, "relief_m": 700},
            "plateau": {"elevation_m": 1400, "relief_m": 10},
        },
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert len(outcome.hotels) == 3
    assert outcome.resolved_terms == ("высоко в горах",)
    assert {row.hotel_id: row.value for row in outcome.facts} == {
        "city": False,
        "mountain": True,
        "plateau": False,
    }
    fact = next(row for row in outcome.facts if row.hotel_id == "mountain")
    scored = score(outcome.intents, {fact.characteristic_key: fact_from_record(fact)}, NOW)
    assert scored.matches[0].quality is MatchQuality.PARTIAL
    assert "1500" in fact.explanation and "700" in fact.explanation
    assert fact.geo_refs
    terrain.measure.assert_awaited_once()
    context = json.loads(llm.explore_data.await_args_list[-1].args[0])
    assert context["observations"][-1]["result"]["measured_count"] == 3


async def test_agent_cannot_use_a_measurement_that_was_not_returned_by_tools() -> None:
    explorer, _, _ = build(
        [
            DataStep(action="measure_terrain", arguments={"radius_m": 1000}),
            DataStep(action="finish", arguments={}, criteria=(criterion("invented.altitude"),)),
        ],
        readings={"city": {"elevation_m": 1500, "relief_m": 700}},
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert outcome.facts == ()
    assert outcome.resolved_terms == ()


async def test_agent_can_recover_from_a_tool_error_using_observations() -> None:
    explorer, llm, _ = build(
        [
            DataStep(action="read_records", arguments={"dataset": "rooms", "filters": []}),
            DataStep(action="inspect_data", arguments={}),
            DataStep(action="finish", arguments={}, question="На какую дату нужен номер?"),
        ]
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    context = json.loads(llm.explore_data.await_args_list[1].args[0])
    assert any("error" in item["result"] for item in context["observations"])
    assert outcome.question == "На какую дату нужен номер?"


async def test_missing_room_inventory_is_not_counted_as_proof_of_absence() -> None:
    wanted = DataCriterion(
        term="без телевизора",
        source_text="без телевизора",
        required=False,
        checks=(DataCheck(field="r1.match_count", op="eq", value=0),),
        explanation="Нет телевизора",
    )
    explorer, _, _ = build(
        [
            DataStep(
                action="read_records",
                arguments={
                    "dataset": "rooms",
                    "filters": [{"field": "included", "op": "contains", "value": "телевизор"}],
                },
            ),
            DataStep(action="finish", arguments={}, criteria=(wanted,)),
        ]
    )

    outcome = await explorer(
        "отель без телевизора в Сочи",
        ("без телевизора",),
        "Сочи",
        "sochi",
        [hotel("city")],
        None,
        True,
    )

    assert outcome.facts == ()
    assert outcome.resolved_terms == ()


async def test_valid_grounded_plan_survives_a_later_provider_failure() -> None:
    explorer, _, _ = build(
        [
            DataStep(
                action="measure_terrain", arguments={"radius_m": 1000, "search_radius_m": 30000}
            ),
            DataStep(action="inspect_data", arguments={}, criteria=(criterion(),)),
            ModelFailure("provider unavailable"),
        ],
        readings={"mountain": {"elevation_m": 1600, "relief_m": 600}},
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert outcome.resolved_terms == ("высоко в горах",)
    assert outcome.facts[0].value is True


async def test_proposed_checks_are_grounded_after_the_measurement_before_next_model_call() -> None:
    explorer, _, _ = build(
        [
            DataStep(
                action="measure_terrain", arguments={"radius_m": 1000}, criteria=(criterion(),)
            ),
            ModelFailure("provider unavailable"),
        ],
        readings={"city": {"elevation_m": 1600, "relief_m": 600}},
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert outcome.facts[0].value is True
    assert "1600" in outcome.facts[0].explanation
    assert "900" in outcome.facts[0].explanation
