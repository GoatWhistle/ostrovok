from dataclasses import replace
from pathlib import Path

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import DemandRecord
from hotel_agent.application.use_cases.prune_questions import PruneHotelierQuestions
from tests.unit.application.hotelier_fakes import FixedClock, Store, factory, question

REGION = "sochi"


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def prune(store: Store, registry: YamlCharacteristicRegistry) -> PruneHotelierQuestions:
    return PruneHotelierQuestions(factory(store), registry, FixedClock())


def blocked(hotel: str, key: str, hits: int = 3) -> DemandRecord:
    return DemandRecord(hotel_id=hotel, characteristic_key=key, appearances=hits + 1, blocked=hits)


def queue() -> Store:
    return Store(
        questions={
            "q_wanted": question("q_wanted", "h1", "pets_policy"),
            "q_noise": question("q_noise", "h1", "room_capacity"),
            "q_hidden": replace(question("q_hidden", "h2", "pets_policy"), status="skipped"),
            "q_done": replace(question("q_done", "h2", "room_capacity"), status="answered"),
        },
        demand=[blocked("h1", "pets_policy", 6), blocked("h2", "pets_policy", 4)],
    )


async def test_a_dry_run_reports_without_touching_the_queue(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = queue()

    report = await prune(store, registry)(REGION)

    assert (report.backed, report.unbacked, report.deferred) == (2, 1, 1)
    assert not report.applied
    assert {item.id: item.status for item in store.questions.values()} == {
        "q_wanted": "open",
        "q_noise": "open",
        "q_hidden": "skipped",
        "q_done": "answered",
    }


async def test_applying_defers_the_noise_and_reopens_what_is_asked_for(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = queue()

    report = await prune(store, registry)(REGION, apply=True)

    assert (report.deferred, report.reopened, report.applied) == (1, 1, True)
    assert {item.id: item.status for item in store.questions.values()} == {
        "q_wanted": "open",
        "q_noise": "skipped",
        "q_hidden": "open",
        "q_done": "answered",
    }


async def test_a_reopened_question_reaches_the_hotelier(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = queue()

    await prune(store, registry)(REGION, apply=True)

    opened = [item for item in store.notifications.values() if item.kind == "question_opened"]
    assert [item.question_id for item in opened] == ["q_hidden"]
    assert opened[0].payload["blocked_searches"] == 4


async def test_an_answered_question_is_never_reopened_or_deferred(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(
        questions={"q_done": replace(question("q_done", "h1", "pets_policy"), status="answered")},
        demand=[blocked("h2", "pets_policy")],
    )

    await prune(store, registry)(REGION, apply=True)

    assert store.questions["q_done"].status == "answered"


async def test_without_demand_a_dry_run_changes_nothing(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = queue()
    store.demand = []

    report = await prune(store, registry)(REGION)

    assert report == type(report)()
    assert store.questions["q_noise"].status == "open"
    assert store.questions["q_hidden"].status == "skipped"


async def test_without_demand_applying_falls_back_to_the_unseen_sweep(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = queue()
    store.demand = []

    report = await prune(store, registry)(REGION, apply=True)

    assert (report.deferred, report.applied) == (2, True)
    assert store.questions["q_wanted"].status == "skipped"
    assert store.questions["q_noise"].status == "skipped"
    assert store.questions["q_done"].status == "answered"
