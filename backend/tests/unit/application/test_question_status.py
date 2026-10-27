from dataclasses import replace
from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
)
from hotel_agent.domain.entities import QuestionStatus
from hotel_agent.domain.errors import InvalidValue, QuestionAnswered, QuestionNotFound
from tests.unit.application.hotelier_fakes import (
    NOW,
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


async def test_deferral_persists_and_reopened_question_accepts_an_answer(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    change = ChangeQuestionStatus(factory(store))
    skipped = await change("q1", QuestionStatus.SKIPPED)
    assert skipped.status is QuestionStatus.SKIPPED
    assert store.questions["q1"].status == "skipped"
    commits = store.commits
    assert (await change("q1", QuestionStatus.SKIPPED)).status is QuestionStatus.SKIPPED
    assert store.commits == commits
    answer = AnswerHotelierQuestion(
        factory(store), registry, FakeLLM(registry), FixedClock(), Ids()
    )
    with pytest.raises(InvalidValue):
        await answer("q1", "Можно с собакой")
    assert (await change("q1", QuestionStatus.OPEN)).status is QuestionStatus.OPEN
    result = await answer("q1", "Можно с собакой до 10 кг")
    listed = {str(item.id): item for item in await ListHotelierQuestions(factory(store))("h1")}
    assert listed["q1"].status is QuestionStatus.ANSWERED
    assert listed["q1"].answer_text == "Можно с собакой до 10 кг"
    assert listed["q1"].answered_at == NOW
    assert listed["q1"].answer_fact_ids == (result.extracted[0].id,)


async def test_answered_questions_and_unknown_ids_keep_their_state() -> None:
    store = Store(
        questions={"q1": replace(question("q1", "h1", "pets_policy"), status="answered")},
        facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)},
    )
    change = ChangeQuestionStatus(factory(store))
    for status in (QuestionStatus.SKIPPED, QuestionStatus.OPEN):
        with pytest.raises(QuestionAnswered):
            await change("q1", status)
    with pytest.raises(QuestionNotFound):
        await change("missing", QuestionStatus.SKIPPED)
    with pytest.raises(InvalidValue):
        await change("q1", QuestionStatus.ANSWERED)
    assert store.questions["q1"].status == "answered"
    assert store.commits == 0
    listed = await ListHotelierQuestions(factory(store))("h1")
    assert listed[0].answer_fact_ids == ()
