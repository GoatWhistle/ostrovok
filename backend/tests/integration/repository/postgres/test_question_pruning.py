import psycopg
import pytest

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.application.use_cases.hotelier_questions import PlanHotelierQuestions
from hotel_agent.application.use_cases.prune_questions import PruneHotelierQuestions
from tests.integration.repository.postgres.hotelier_setup import REGISTRY, seed_hotel, services
from tests.integration.repository.postgres.test_hotelier_demand import record_search

pytestmark = pytest.mark.anyio


async def statuses(url: str, hotel_id: str) -> dict[str, str]:
    async with await psycopg.AsyncConnection.connect(url) as connection:
        cursor = await connection.execute(
            """SELECT characteristic_key, status FROM hotelier_questions
            WHERE hotel_id = %(hotel)s ORDER BY characteristic_key""",
            {"hotel": hotel_id},
        )
        return {str(row[0]): str(row[1]) for row in await cursor.fetchall()}


async def test_a_saturated_queue_keeps_only_what_searches_ask_for(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    uow, _, _ = services(disposable_database)
    try:
        queued = await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=10)
        await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
        prune = PruneHotelierQuestions(uow, REGISTRY, SystemClock())

        dry = await prune(region)
        applied = await prune(region, apply=True)

        assert queued == 3
        assert (dry.backed, dry.unbacked, dry.applied) == (1, 2, False)
        assert (applied.deferred, applied.reopened) == (2, 0)
        assert await statuses(disposable_database, hotel) == {
            "double_room": "skipped",
            "pets_policy": "open",
            "room_capacity": "skipped",
        }
    finally:
        await uow.aclose()


async def test_a_deferred_question_comes_back_when_a_search_needs_it(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    uow, _, _ = services(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=10)
        await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
        prune = PruneHotelierQuestions(uow, REGISTRY, SystemClock())
        await prune(region, apply=True)

        await record_search(disposable_database, region, hotel, [("room_capacity", "unknown")])
        report = await prune(region, apply=True)

        assert report.reopened == 1
        assert await statuses(disposable_database, hotel) == {
            "double_room": "skipped",
            "pets_policy": "open",
            "room_capacity": "open",
        }
    finally:
        await uow.aclose()


async def test_an_answered_question_survives_pruning(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    uow, answer, _ = services(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=10)
        await answer(f"q_{hotel}_pets_policy", "Можно с собаками до 10 кг")
        await record_search(disposable_database, region, hotel, [("double_room", "unknown")])

        await PruneHotelierQuestions(uow, REGISTRY, SystemClock())(region, apply=True)

        assert await statuses(disposable_database, hotel) == {
            "double_room": "open",
            "pets_policy": "answered",
            "room_capacity": "skipped",
        }
    finally:
        await uow.aclose()
