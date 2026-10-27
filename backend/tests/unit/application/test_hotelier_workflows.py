from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.hotelier_questions import (
    ListHotelierQuestions,
    PlanHotelierQuestions,
)
from hotel_agent.domain.entities import FactStatus, QuestionStatus
from hotel_agent.domain.errors import FactNotFound, HotelNotFound, InvalidValue, QuestionNotFound
from tests.unit.application.hotelier_fakes import (
    FixedClock,
    Ids,
    Store,
    computed_fact,
    factory,
    question,
)


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def answering(store: Store, registry: YamlCharacteristicRegistry) -> AnswerHotelierQuestion:
    return AnswerHotelierQuestion(factory(store), registry, FakeLLM(registry), FixedClock(), Ids())


def changes(store: Store, registry: YamlCharacteristicRegistry) -> ChangeFacts:
    return ChangeFacts(factory(store), registry, FixedClock(), Ids())


async def test_unclear_answer_keeps_question_open_and_stores_text(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    result = await answering(store, registry)("q1", "Уточню позже")
    assert result.follow_up is not None
    assert result.follow_up.status is QuestionStatus.OPEN
    assert result.extracted == ()
    assert store.questions["q1"].status == "open"
    assert store.questions["q1"].answer_text == "Уточню позже"
    assert not store.facts


async def test_recognized_answer_creates_confirmed_fact_with_quotes(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    result = await answering(store, registry)("q1", "Можно с собакой до 10 кг, плата 500 рублей.")
    fact = result.extracted[0]
    assert fact.status is FactStatus.CONFIRMED_BY_HOTELIER
    assert fact.value == {"allowed": True, "max_weight_kg": 10.0, "fee_rub": 500.0}
    assert [item.text for item in fact.provenance.evidence] == ["можно", "10 кг", "500 руб"]
    assert store.questions["q1"].status == "answered"
    assert store.facts[str(fact.id)].evidence[0] == ("quote", "можно")
    with pytest.raises(InvalidValue):
        await answering(store, registry)("q1", "Можно")


async def test_agreeing_answer_supersedes_computed_fact_without_breaking_uniqueness(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(
        facts={"f_room": computed_fact("f_room", "h1", "double_room", True)},
        questions={"q1": question("q1", "h1", "double_room")},
    )
    result = await answering(store, registry)("q1", "Да, есть двухместные номера")
    assert result.conflicts == ()
    assert store.facts["f_room"].status == "superseded"
    assert store.facts[str(result.extracted[0].id)].status == "confirmed_by_hotelier"


async def test_disagreeing_answer_wins_by_rule_and_keeps_history(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(
        facts={"f_room": computed_fact("f_room", "h1", "double_room", True)},
        questions={"q1": question("q1", "h1", "double_room")},
    )
    result = await answering(store, registry)("q1", "Нет, только одноместные")
    assert result.conflicts[0].resolution == "resolved_by_rule"
    assert result.conflicts[0].winner_fact_id == str(result.extracted[0].id)
    detail = await GetFact(factory(store))("h1", str(result.extracted[0].id))
    assert [item.status for item in detail.history] == [FactStatus.SUPERSEDED]
    assert detail.conflicts == result.conflicts


async def test_contradicting_hotelier_answers_stay_pending_until_confirmed(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "double_room")})
    first = await answering(store, registry)("q1", "Есть")
    store.questions["q2"] = question("q2", "h1", "double_room")
    second = await answering(store, registry)("q2", "Нет")
    assert second.conflicts[0].resolution == "pending"
    statuses = {item.status for item in store.facts.values()}
    assert statuses == {"conflicted"}
    confirmed = await changes(store, registry).confirm(str(first.extracted[0].id))
    assert confirmed.status is FactStatus.CONFIRMED_BY_HOTELIER
    conflict = store.conflicts[second.conflicts[0].id]
    assert conflict.resolution == "resolved_by_hotelier"
    assert conflict.winner_fact_id == str(first.extracted[0].id)
    assert store.facts[str(second.extracted[0].id)].status == "superseded"


async def test_correction_creates_new_version_and_rejects_stale_version(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)})
    service = changes(store, registry)
    corrected = await service.correct("f_h", 18, "Измерено по проекту")
    assert corrected.value == 18.0
    assert str(corrected.id) != "f_h"
    assert store.facts["f_h"].status == "superseded"
    assert store.facts[str(corrected.id)].evidence == (("quote", "Измерено по проекту"),)
    with pytest.raises(InvalidValue):
        await service.correct("f_h", 20, "")
    with pytest.raises(InvalidValue):
        await service.confirm("f_h")
    detail = await GetFact(factory(store))("h1", "f_h")
    assert [str(item.id) for item in detail.history] == [str(corrected.id)]


@pytest.mark.parametrize("value", [-1, True, "high", None, float("inf")])
async def test_invalid_corrections_write_nothing(
    registry: YamlCharacteristicRegistry, value: object
) -> None:
    store = Store(facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)})
    with pytest.raises(InvalidValue):
        await changes(store, registry).correct("f_h", value, "")
    assert store.commits == 0
    assert store.facts["f_h"].status == "active"


async def test_object_corrections_check_registry_fields(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(facts={"f_p": computed_fact("f_p", "h1", "pets_policy", {"allowed": False})})
    service = changes(store, registry)
    with pytest.raises(InvalidValue):
        await service.correct("f_p", {"allowed": True, "parrots": 2}, "")
    with pytest.raises(InvalidValue):
        await service.correct("f_p", {"allowed": "yes"}, "")
    with pytest.raises(InvalidValue, match="nonnegative"):
        await service.correct("f_p", {"allowed": True, "max_weight_kg": -5}, "")
    corrected = await service.correct("f_p", {"allowed": False, "fee_rub": 0}, "")
    assert corrected.value == {"allowed": False, "fee_rub": 0}


async def test_confirm_is_idempotent_and_refuses_computing_facts(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(
        facts={
            "f_h": computed_fact("f_h", "h1", "building_height", 12.0),
            "f_c": computed_fact("f_c", "h1", "distance_to_sea", None, status="computing"),
        }
    )
    service = changes(store, registry)
    first = await service.confirm("f_h")
    again = await service.confirm("f_h")
    assert first == again
    assert store.commits == 1
    with pytest.raises(InvalidValue):
        await service.confirm("f_c")
    with pytest.raises(FactNotFound):
        await service.confirm("missing")


async def test_fact_of_another_hotel_is_not_found(registry: YamlCharacteristicRegistry) -> None:
    store = Store(facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)})
    with pytest.raises(FactNotFound):
        await GetFact(factory(store))("h2", "f_h")
    with pytest.raises(HotelNotFound):
        await GetFact(factory(store))("missing", "f_h")


async def test_question_planning_is_repeatable_and_skips_known_facts(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(facts={"f_room": computed_fact("f_room", "h1", "double_room", True)})
    plan = PlanHotelierQuestions(factory(store), registry, FixedClock())
    assert await plan("sochi") == 5
    assert await plan("sochi") == 0
    listed = await ListHotelierQuestions(factory(store))("h1")
    assert {item.characteristic_key for item in listed} == {"pets_policy", "room_capacity"}
    assert all("Hotel h1" in item.text for item in listed)
    with pytest.raises(HotelNotFound):
        await ListHotelierQuestions(factory(store))("missing")


async def test_answer_to_missing_or_empty_question_fails(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    with pytest.raises(QuestionNotFound):
        await answering(store, registry)("missing", "Можно")
    with pytest.raises(InvalidValue):
        await answering(store, registry)("q1", "   ")
