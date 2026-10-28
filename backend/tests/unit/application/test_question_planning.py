from pathlib import Path

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import DemandRecord
from hotel_agent.application.use_cases.hotelier_questions import PlanHotelierQuestions
from hotel_agent.domain.entities import QuestionStatus
from tests.unit.application.hotelier_fakes import FixedClock, Store, factory

REGION = "sochi"
ASKABLE = ("double_room", "pets_policy", "room_capacity")


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def plan(store: Store, registry: YamlCharacteristicRegistry) -> PlanHotelierQuestions:
    return PlanHotelierQuestions(factory(store), registry, FixedClock())


def blocked(hotel: str, key: str, hits: int) -> DemandRecord:
    return DemandRecord(hotel_id=hotel, characteristic_key=key, appearances=hits + 2, blocked=hits)


async def test_a_blocked_search_decides_who_is_asked(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=[blocked("h2", "pets_policy", 5)])

    added = await plan(store, registry)(REGION)

    asked = {(item.hotel_id, item.characteristic_key) for item in store.questions.values()}
    assert added == 1
    assert asked == {("h2", "pets_policy")}


async def test_the_question_carries_the_demand_that_earned_it(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=[blocked("h1", "pets_policy", 4)])

    await plan(store, registry)(REGION)

    opened = [item for item in store.notifications.values() if item.kind == "question_opened"]
    assert len(opened) == 1
    assert opened[0].payload["blocked_searches"] == 4
    assert opened[0].payload["reason"] == "missing"
    assert opened[0].severity == "action"


async def test_demand_outranks_the_rest_of_the_queue(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=[blocked("h1", "pets_policy", 1), blocked("h2", "room_capacity", 9)])

    await plan(store, registry)(REGION, limit=1)

    assert [item.hotel_id for item in store.questions.values()] == ["h2"]


async def test_a_fresh_region_still_gets_a_bounded_starter_queue(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store()

    added = await plan(store, registry)(REGION, cold_start=2)

    assert added == 2
    assert len(store.questions) == 2


async def test_without_demand_and_without_a_cold_start_nothing_is_queued(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store()

    added = await plan(store, registry)(REGION, cold_start=0)

    assert added == 0
    assert store.questions == {}
    assert store.notifications == {}


async def test_planning_twice_does_not_ask_again(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=[blocked("h1", "pets_policy", 3)])
    planner = plan(store, registry)

    first = await planner(REGION)
    again = await planner(REGION)

    assert (first, again) == (1, 0)
    assert len(store.questions) == 1


async def test_a_question_text_names_the_hotel(registry: YamlCharacteristicRegistry) -> None:
    store = Store(demand=[blocked("h1", "pets_policy", 2)])

    await plan(store, registry)(REGION)

    queued = next(iter(store.questions.values()))
    assert "Hotel h1" in queued.text
    assert queued.status == QuestionStatus.OPEN.value
