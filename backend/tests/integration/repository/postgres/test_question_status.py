import asyncio
from typing import cast

import psycopg
import pytest

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.application.ports.llm import Extraction, LLMPort
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
    PlanHotelierQuestions,
)
from hotel_agent.domain.entities import HotelierQuestion, QuestionStatus
from hotel_agent.domain.errors import InvalidValue, QuestionAnswered
from tests.integration.repository.postgres.hotelier_setup import (
    REGISTRY,
    fact_rows,
    seed_hotel,
    services,
)


class GatedLLM:
    def __init__(self) -> None:
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self._fake = FakeLLM(REGISTRY)

    async def extract_fields(self, characteristic_key: str, answer: str) -> Extraction:
        self.entered.set()
        await self.release.wait()
        return await self._fake.extract_fields(characteristic_key, answer)


async def listed(url: str, hotel: str) -> dict[str, HotelierQuestion]:
    fresh = PostgresUnitOfWorkFactory(url)
    try:
        return {str(item.id): item for item in await ListHotelierQuestions(fresh)(hotel)}
    finally:
        await fresh.aclose()


async def test_deferral_survives_reload_and_links_the_saved_answer(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    question_id = f"q_{hotel}_pets_policy"
    uow, answer, _ = services(disposable_database)
    change = ChangeQuestionStatus(uow)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region)
        await change(question_id, QuestionStatus.SKIPPED)
        await change(question_id, QuestionStatus.SKIPPED)
        assert (await listed(disposable_database, hotel))[question_id].status.value == "skipped"
        await change(question_id, QuestionStatus.OPEN)
        result = await answer(question_id, "Можно с собакой до 10 кг, плата 500 рублей.")
        with pytest.raises(QuestionAnswered):
            await change(question_id, QuestionStatus.SKIPPED)
    finally:
        await uow.aclose()
    saved = (await listed(disposable_database, hotel))[question_id]
    assert saved.status is QuestionStatus.ANSWERED
    assert saved.answer_text == "Можно с собакой до 10 кг, плата 500 рублей."
    assert saved.answered_at is not None
    assert saved.answer_fact_ids == (result.extracted[0].id,)


async def test_a_question_without_a_stored_link_reports_no_facts(
    disposable_database: str,
) -> None:
    _, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        await connection.execute(
            """INSERT INTO hotelier_questions(id, hotel_id, characteristic_key, text, reason,
                created_at, status, answer_text)
            VALUES (%(id)s, %(hotel)s, 'pets_policy', '?', 'missing', now(), 'answered', 'Да')""",
            {"id": f"q_legacy_{hotel}", "hotel": hotel},
        )
    legacy = (await listed(disposable_database, hotel))[f"q_legacy_{hotel}"]
    assert legacy.answer_text == "Да"
    assert legacy.answered_at is None
    assert legacy.answer_fact_ids == ()


async def test_deferral_during_the_model_call_blocks_the_late_answer(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    question_id = f"q_{hotel}_pets_policy"
    gate = GatedLLM()
    uow, answer, _ = services(disposable_database, cast(LLMPort, gate))
    other = PostgresUnitOfWorkFactory(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region)
        pending = asyncio.create_task(answer(question_id, "С питомцами нельзя"))
        await asyncio.wait_for(gate.entered.wait(), timeout=5)
        skipped = await asyncio.wait_for(
            ChangeQuestionStatus(other)(question_id, QuestionStatus.SKIPPED), timeout=5
        )
        gate.release.set()
        with pytest.raises(InvalidValue):
            await pending
    finally:
        await uow.aclose()
        await other.aclose()
    assert skipped.status is QuestionStatus.SKIPPED
    assert await fact_rows(disposable_database, hotel, "pets_policy") == []
    assert (await listed(disposable_database, hotel))[question_id].status.value == "skipped"


async def test_simultaneous_answer_and_deferral_leave_one_consistent_outcome(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    question_id = f"q_{hotel}_pets_policy"
    first, answer, _ = services(disposable_database)
    second = PostgresUnitOfWorkFactory(disposable_database)
    try:
        await PlanHotelierQuestions(first, REGISTRY, SystemClock())(region)
        outcomes = await asyncio.gather(
            answer(question_id, "С питомцами нельзя"),
            ChangeQuestionStatus(second)(question_id, QuestionStatus.SKIPPED),
            return_exceptions=True,
        )
    finally:
        await first.aclose()
        await second.aclose()
    status = (await listed(disposable_database, hotel))[question_id].status.value
    facts = await fact_rows(disposable_database, hotel, "pets_policy")
    failures = sorted(type(item).__name__ for item in outcomes if isinstance(item, Exception))
    if status == "answered":
        assert failures == ["QuestionAnswered"]
        assert len(facts) == 1
    else:
        assert status == "skipped"
        assert failures == ["InvalidValue"]
        assert facts == []
