from dataclasses import replace
from datetime import timedelta
from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import ConflictRecord, DemandRecord, SearchHotelRecord
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.answer_questions import AnswerHotelierQuestions
from hotel_agent.application.use_cases.hotelier_cabinet import GetHotelierCabinet
from hotel_agent.domain.errors import HotelNotFound, InvalidValue
from hotel_agent.domain.services.hotelier_attention import ActionKind
from tests.unit.application.hotelier_fakes import (
    NOW,
    FixedClock,
    Ids,
    Store,
    computed_fact,
    factory,
    question,
)

HOTEL = SearchHotelRecord(
    id="h1",
    region_id="sochi",
    name="Hotel h1",
    location=(39.72, 43.58),
    stars=4,
    building_id="b1",
    height_m=18.0,
    levels=6,
    footprint=None,
)


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def store(**kwargs: object) -> Store:
    built = Store(**kwargs)  # type: ignore[arg-type]
    built.hotel_records["h1"] = HOTEL
    return built


def cabinet(current: Store, registry: YamlCharacteristicRegistry) -> GetHotelierCabinet:
    return GetHotelierCabinet(factory(current), registry, FixedClock())


async def test_an_unknown_hotel_has_no_cabinet(registry: YamlCharacteristicRegistry) -> None:
    with pytest.raises(HotelNotFound):
        await cabinet(store(), registry)("missing")


async def test_the_cabinet_counts_what_the_system_knows(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(
        facts={
            "f1": computed_fact("f1", "h1", "distance_to_sea", 420.0),
            "f2": computed_fact("f2", "h1", "pets_policy", True, status="confirmed_by_hotelier"),
        }
    )

    overview = await cabinet(current, registry)("h1")

    assert overview.hotel.name == "Hotel h1"
    assert overview.coverage.known == 2
    assert overview.coverage.confirmed == 1
    assert overview.coverage.unknown == overview.coverage.total - 2
    assert 0.0 < overview.coverage.completeness < 1.0


async def test_every_registry_characteristic_gets_a_state(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(facts={"f1": computed_fact("f1", "h1", "distance_to_sea", 420.0)})

    overview = await cabinet(current, registry)("h1")

    states = {item.key: item.state for item in overview.characteristics}
    assert states["distance_to_sea"] == "known"
    assert states["pets_policy"] == "unknown"
    assert len(overview.characteristics) == len(registry.all())


async def test_a_disputed_value_is_labelled_and_leads_the_next_step(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(
        facts={"f1": computed_fact("f1", "h1", "room_capacity", 4.0)},
        conflicts={
            "c1": ConflictRecord(
                id="c1",
                subject_type="hotel",
                subject_id="h1",
                characteristic_key="room_capacity",
                fact_ids=("f1", "f2"),
                resolution="pending",
                rule="hotelier > fresh_computed",
                winner_fact_id=None,
            )
        },
        questions={"q1": question("q1", "h1", "pets_policy")},
    )

    overview = await cabinet(current, registry)("h1")

    states = {item.key: item.state for item in overview.characteristics}
    assert states["room_capacity"] == "disputed"
    assert overview.next_action is not None
    assert overview.next_action.kind is ActionKind.RESOLVE_CONFLICT
    assert overview.next_action.reference == "c1"


async def test_without_a_conflict_the_hottest_question_is_the_next_step(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(
        questions={
            "q1": question("q1", "h1", "pets_policy"),
            "q2": question("q2", "h1", "room_capacity"),
        },
        demand=[
            DemandRecord(
                hotel_id="h1", characteristic_key="room_capacity", appearances=12, blocked=8
            )
        ],
        appearances=12,
    )

    overview = await cabinet(current, registry)("h1")

    assert overview.appearances == 12
    assert overview.next_action is not None
    assert overview.next_action.kind is ActionKind.ANSWER_QUESTION
    assert overview.next_action.reference == "q2"
    assert [item.blocked_searches for item in overview.questions] == [8, 0]


async def test_an_expiring_statement_asks_to_be_reconfirmed(
    registry: YamlCharacteristicRegistry,
) -> None:
    fact = replace(
        computed_fact("f1", "h1", "pets_policy", True, status="confirmed_by_hotelier"),
        valid_until=NOW + timedelta(days=5),
    )
    current = store(facts={"f1": fact})

    overview = await cabinet(current, registry)("h1")

    assert [str(item.id) for item in overview.expiring] == ["f1"]
    assert overview.next_action is not None
    assert overview.next_action.kind is ActionKind.RECONFIRM_VALUE


async def test_a_quiet_cabinet_asks_for_nothing(
    registry: YamlCharacteristicRegistry,
) -> None:
    overview = await cabinet(store(), registry)("h1")

    assert overview.next_action is None
    assert overview.questions == ()
    assert overview.expiring == ()
    assert overview.unread.total == 0


async def test_one_message_answers_several_questions(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store(
        questions={
            "q1": question("q1", "h1", "pets_policy"),
            "q2": question("q2", "h1", "room_capacity"),
        }
    )
    llm = FakeLLM(registry)
    batch = AnswerHotelierQuestions(
        factory(current),
        llm,
        AnswerHotelierQuestion(factory(current), registry, llm, FixedClock(), Ids()),
    )

    result = await batch("h1", "С собаками до 10 кг, доплата 2500 рублей")

    assert [item.question_id for item in result.applied] == ["q1"]
    assert result.untouched == ("q2",)
    assert current.questions["q1"].status == "answered"
    assert current.questions["q2"].status == "open"


async def test_a_batch_answer_needs_an_open_question(
    registry: YamlCharacteristicRegistry,
) -> None:
    current = store()
    llm = FakeLLM(registry)
    batch = AnswerHotelierQuestions(
        factory(current),
        llm,
        AnswerHotelierQuestion(factory(current), registry, llm, FixedClock(), Ids()),
    )

    with pytest.raises(InvalidValue):
        await batch("h1", "можно с собаками")
