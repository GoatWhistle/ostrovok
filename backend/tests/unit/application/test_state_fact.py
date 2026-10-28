from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.use_cases.state_fact import StateHotelierFact
from hotel_agent.domain.entities import FactStatus
from hotel_agent.domain.errors import HotelNotFound, InvalidValue, UnknownCharacteristic
from tests.unit.application.hotelier_fakes import (
    FixedClock,
    Ids,
    Store,
    computed_fact,
    factory,
)

HOTEL = SearchHotelRecord(
    id="h1",
    region_id="sochi",
    name="Hotel h1",
    location=(39.72, 43.58),
    stars=3,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def store(**kwargs: object) -> Store:
    built = Store(**kwargs)  # type: ignore[arg-type]
    built.hotel_records["h1"] = HOTEL
    return built


def service(current: Store, registry: YamlCharacteristicRegistry) -> StateHotelierFact:
    return StateHotelierFact(factory(current), registry, FakeLLM(registry), FixedClock(), Ids())


async def test_a_hotelier_states_a_value_nobody_asked_about(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store()

    result = await service(current, registry)(
        "h1", "pets_policy", "Можно с собаками до 10 кг, доплата 2500 рублей"
    )

    assert result.fact.status is FactStatus.CONFIRMED_BY_HOTELIER
    assert result.fact.provenance.method == "hotelier_statement@1"
    assert result.fact.provenance.source.ref is None
    assert result.fact.value == {"allowed": True, "max_weight_kg": 10.0, "fee_rub": 2500.0}
    assert result.fact.provenance.evidence[0].text
    assert result.conflicts == ()
    assert len(current.facts) == 1


async def test_a_statement_against_a_computed_value_is_recorded_as_a_conflict(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(facts={"f1": computed_fact("f1", "h1", "room_capacity", 4.0)})

    result = await service(current, registry)("h1", "room_capacity", "До 2 взрослых")

    assert result.fact.value == 2.0
    assert len(result.conflicts) == 1
    assert result.conflicts[0].characteristic_key == "room_capacity"
    assert result.conflicts[0].rule
    assert result.conflicts[0].resolution == "resolved_by_rule"
    assert result.conflicts[0].winner_fact_id == str(result.fact.id)
    assert [item.kind for item in current.notifications.values()] == ["conflict_resolved"]


async def test_a_statement_the_model_cannot_read_is_refused(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store()

    with pytest.raises(InvalidValue):
        await service(current, registry)("h1", "pets_policy", "здравствуйте")
    assert current.facts == {}


async def test_a_statement_about_a_room_or_facade_is_refused(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store()

    with pytest.raises(InvalidValue):
        await service(current, registry)("h1", "blackout_curtains", "Шторы плотные")
    with pytest.raises(InvalidValue):
        await service(current, registry)("h1", "noise_level", "У нас тихо")


async def test_a_statement_needs_a_known_hotel_and_characteristic(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store()

    with pytest.raises(HotelNotFound):
        await service(current, registry)("missing", "pets_policy", "Можно с собаками")
    with pytest.raises(UnknownCharacteristic):
        await service(current, registry)("h1", "nope", "Можно с собаками")


async def test_an_empty_statement_is_refused(registry: YamlCharacteristicRegistry) -> None:
    current = store()

    with pytest.raises(InvalidValue):
        await service(current, registry)("h1", "pets_policy", "   ")
