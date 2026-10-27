import asyncio
from typing import cast

import psycopg
import pytest

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.ports.llm import Extraction, LLMPort
from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.hotelier_questions import (
    ListHotelierQuestions,
    PlanHotelierQuestions,
)
from hotel_agent.domain.entities import FactStatus
from hotel_agent.domain.errors import FactNotFound, InvalidValue
from tests.integration.repository.postgres.hotelier_setup import (
    REGISTRY,
    fact_rows,
    precompute,
    seed_hotel,
    services,
)


async def test_answers_persist_with_quotes_after_a_new_connection(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    uow, answer, _ = services(disposable_database)
    try:
        assert await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region) == 3
        assert await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region) == 0
        question_id = f"q_{hotel}_pets_policy"
        unclear = await answer(question_id, "Уточню позже")
        assert unclear.follow_up is not None
        result = await answer(question_id, "Можно с собакой до 10 кг, плата 500 рублей.")
    finally:
        await uow.aclose()
    fresh = PostgresUnitOfWorkFactory(disposable_database)
    try:
        questions = {str(item.id): item for item in await ListHotelierQuestions(fresh)(hotel)}
        detail = await GetFact(fresh)(hotel, str(result.extracted[0].id))
        card = await GetHotelCard(fresh, SystemClock())(hotel)
    finally:
        await fresh.aclose()
    assert questions[question_id].status.value == "answered"
    assert card.open_questions == 2
    assert detail.fact.value == {"allowed": True, "max_weight_kg": 10.0, "fee_rub": 500.0}
    assert [item.text for item in detail.fact.provenance.evidence] == ["можно", "10 кг", "500 руб"]
    assert detail.fact.provenance.observed_at is not None


async def test_confirmation_and_correction_keep_history(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await precompute(disposable_database, region)
    uow, _, changes = services(disposable_database)
    try:
        confirmed = await changes.confirm(f"f_height_{hotel}")
        assert confirmed.status is FactStatus.CONFIRMED_BY_HOTELIER
        before = await fact_rows(disposable_database, hotel, "building_height")
        with pytest.raises(InvalidValue):
            await changes.correct(f"f_height_{hotel}", "высокий", "")
        assert await fact_rows(disposable_database, hotel, "building_height") == before
        corrected = await changes.correct(f"f_height_{hotel}", 21.5, "Паспорт здания")
        old = await GetFact(uow)(hotel, f"f_height_{hotel}")
        new = await GetFact(uow)(hotel, str(corrected.id))
        with pytest.raises(FactNotFound):
            await GetFact(uow)(hotel, "f_missing")
    finally:
        await uow.aclose()
    assert old.fact.status is FactStatus.SUPERSEDED
    assert [str(item.id) for item in old.history] == [str(corrected.id)]
    assert new.fact.value == 21.5
    assert new.history[0].status is FactStatus.SUPERSEDED


async def test_overlapping_answers_create_one_fact(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database, double_rooms=False)
    first, answer_a, _ = services(disposable_database)
    second, answer_b, _ = services(disposable_database)
    try:
        await PlanHotelierQuestions(first, REGISTRY, SystemClock())(region)
        question_id = f"q_{hotel}_room_capacity"
        results = await asyncio.gather(
            answer_a(question_id, "До 3 взрослых"),
            answer_b(question_id, "До 3 взрослых"),
            return_exceptions=True,
        )
    finally:
        await first.aclose()
        await second.aclose()
    assert sorted(type(item).__name__ for item in results) == ["AnswerResult", "InvalidValue"]
    rows = await fact_rows(disposable_database, hotel, "room_capacity")
    assert [status for _, _, status in rows] == ["confirmed_by_hotelier"]


async def test_overlapping_corrections_leave_one_winner(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await precompute(disposable_database, region)
    first, _, changes_a = services(disposable_database)
    second, _, changes_b = services(disposable_database)
    try:
        results = await asyncio.gather(
            changes_a.correct(f"f_height_{hotel}", 18, ""),
            changes_b.correct(f"f_height_{hotel}", 24, ""),
            return_exceptions=True,
        )
    finally:
        await first.aclose()
        await second.aclose()
    assert sorted(type(item).__name__ for item in results) == ["Fact", "InvalidValue"]
    statuses = sorted(
        status for _, _, status in await fact_rows(disposable_database, hotel, "building_height")
    )
    assert statuses == ["confirmed_by_hotelier", "superseded"]


async def test_contradicting_answers_wait_for_explicit_confirmation(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database, double_rooms=False)
    uow, answer, changes = services(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region)
        first = await answer(f"q_{hotel}_double_room", "Есть")
        async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
            await connection.execute(
                """INSERT INTO hotelier_questions(id, hotel_id, characteristic_key, text, reason,
                    created_at) VALUES (%(id)s, %(hotel)s, 'double_room', '?', 'conflict', now())""",
                {"id": f"q2_{hotel}", "hotel": hotel},
            )
        second = await answer(f"q2_{hotel}", "Нет")
        pending = second.conflicts[0]
        assert pending.resolution == "pending"
        statuses = [
            status for _, _, status in await fact_rows(disposable_database, hotel, "double_room")
        ]
        assert statuses == ["conflicted", "conflicted"]
        await changes.confirm(str(second.extracted[0].id))
        detail = await GetFact(uow)(hotel, str(first.extracted[0].id))
    finally:
        await uow.aclose()
    assert detail.fact.status is FactStatus.SUPERSEDED
    assert detail.conflicts[0].resolution == "resolved_by_hotelier"
    assert detail.conflicts[0].winner_fact_id == str(second.extracted[0].id)


async def test_failure_before_commit_rolls_back(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    uow = PostgresUnitOfWorkFactory(disposable_database)
    record = SearchFactRecord(
        hotel_id=hotel,
        id=f"f_rollback_{hotel}",
        characteristic_key="building_height",
        value=10.0,
        unit="m",
        qualifiers={},
        source_type="hotelier",
        source_id=None,
        method="hotelier_correction@1",
        confidence=1.0,
        computed_at=SystemClock().now(),
        valid_until=None,
        status="confirmed_by_hotelier",
        geo_refs=(),
        explanation="",
        facade_azimuth=None,
        subject_id=hotel,
        evidence=(("quote", "откат"),),
    )
    try:
        with pytest.raises(RuntimeError):
            async with uow() as work:
                await work.facts.save([record])
                raise RuntimeError("stop before commit")
    finally:
        await uow.aclose()
    assert await fact_rows(disposable_database, hotel, "building_height") == []


async def test_repeated_precompute_keeps_hotelier_changes(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database, double_rooms=False)
    uow, answer, changes = services(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region)
        rooms = await answer(f"q_{hotel}_double_room", "Есть")
        await precompute(disposable_database, region)
        await changes.confirm(f"f_height_{hotel}")
        async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
            await connection.execute(
                """UPDATE buildings SET tags = tags || '{"height":"40"}'
                WHERE id = (SELECT building_id FROM hotels WHERE id = %(hotel)s)""",
                {"hotel": hotel},
            )
        await precompute(disposable_database, region)
    finally:
        await uow.aclose()
    heights = await fact_rows(disposable_database, hotel, "building_height")
    assert heights == [(f"f_height_{hotel}", 16.0, "confirmed_by_hotelier")]
    double = await fact_rows(disposable_database, hotel, "double_room")
    assert double == [(str(rooms.extracted[0].id), True, "confirmed_by_hotelier")]


class LockProbeLLM:
    def __init__(self, url: str, hotel_id: str, question_id: str) -> None:
        self._url, self._hotel, self._question = url, hotel_id, question_id
        self._fake = FakeLLM(REGISTRY)

    async def extract_fields(self, characteristic_key: str, answer: str) -> Extraction:
        async with await psycopg.AsyncConnection.connect(self._url) as connection:
            await connection.execute(
                "SELECT id FROM hotels WHERE id = %(id)s FOR UPDATE NOWAIT", {"id": self._hotel}
            )
            await connection.execute(
                "SELECT id FROM hotelier_questions WHERE id = %(id)s FOR UPDATE NOWAIT",
                {"id": self._question},
            )
        return await self._fake.extract_fields(characteristic_key, answer)


async def test_model_call_holds_no_database_lock(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    question_id = f"q_{hotel}_pets_policy"
    probe = LockProbeLLM(disposable_database, hotel, question_id)
    uow, answer, _ = services(disposable_database, cast(LLMPort, probe))
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region)
        result = await answer(question_id, "С питомцами нельзя")
    finally:
        await uow.aclose()
    assert result.extracted[0].value == {"allowed": False}
