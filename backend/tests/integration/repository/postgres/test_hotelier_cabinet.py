import pytest

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.application.use_cases.answer_questions import AnswerHotelierQuestions
from hotel_agent.application.use_cases.hotelier_cabinet import GetHotelierCabinet
from hotel_agent.application.use_cases.hotelier_notifications import (
    ListHotelierNotifications,
    MarkNotificationsRead,
)
from hotel_agent.application.use_cases.hotelier_questions import PlanHotelierQuestions
from hotel_agent.application.use_cases.sweep_notifications import SweepHotelierNotifications
from hotel_agent.domain.services.hotelier_attention import ActionKind
from tests.integration.repository.postgres.hotelier_setup import REGISTRY, seed_hotel, services
from tests.integration.repository.postgres.test_hotelier_demand import record_search

pytestmark = pytest.mark.anyio


async def test_demand_turns_into_a_question_an_answer_and_a_fact(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
    await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
    uow, answer, _ = services(disposable_database)
    try:
        queued = await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=0)
        cabinet = GetHotelierCabinet(uow, REGISTRY, SystemClock())
        before = await cabinet(hotel)

        assert queued == 1
        assert before.appearances == 2
        assert before.next_action is not None
        assert before.next_action.kind is ActionKind.ANSWER_QUESTION
        assert before.questions[0].blocked_searches == 2
        assert before.coverage.unknown == before.coverage.total

        question_id = str(before.questions[0].question.id)
        result = await answer(question_id, "Можно с собаками до 10 кг, доплата 2500 рублей")
        after = await cabinet(hotel)

        assert result.extracted[0].value == {
            "allowed": True,
            "max_weight_kg": 10.0,
            "fee_rub": 2500.0,
        }
        assert after.coverage.confirmed == 1
        states = {item.key: item.state for item in after.characteristics}
        assert states["pets_policy"] == "confirmed"
        assert after.next_action is None
    finally:
        await uow.aclose()


async def test_the_feed_records_what_happened_and_can_be_read(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
    uow, answer, _ = services(disposable_database)
    try:
        await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=0)
        listing = ListHotelierNotifications(uow, REGISTRY)
        opened = await listing(hotel)
        question_id = str(opened.items[0].notification.question_id)
        await answer(question_id, "С собаками до 10 кг")

        feed = await listing(hotel)
        kinds = [item.notification.kind.value for item in feed.items]

        assert kinds == ["answer_accepted", "question_opened"]
        assert feed.items[0].title == "Размещение с животными"
        assert feed.items[1].question_text is not None
        assert feed.unread.total == 2
        assert feed.unread.action == 1

        read = await MarkNotificationsRead(uow, SystemClock())(hotel)
        unread = await listing(hotel, unread_only=True)

        assert read == 2
        assert unread.items == ()
        assert unread.unread.total == 0
    finally:
        await uow.aclose()


async def test_the_sweep_raises_demand_once_a_day(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(disposable_database, region, hotel, [("room_capacity", "unknown")])
    uow, _, _ = services(disposable_database)
    try:
        sweep = SweepHotelierNotifications(uow, REGISTRY, SystemClock())

        first = await sweep(region)
        again = await sweep(region)
        feed = await ListHotelierNotifications(uow, REGISTRY)(hotel)

        assert first.demand == 1
        assert first.written == 1
        assert again.written == 0
        demand = next(
            item for item in feed.items if item.notification.kind.value == "search_demand"
        )
        assert demand.notification.payload["blocked_searches"] == 1
        assert demand.notification.characteristic_key == "room_capacity"
    finally:
        await uow.aclose()


async def test_one_message_closes_the_whole_queue(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    uow, answer, _ = services(disposable_database)
    try:
        queued = await PlanHotelierQuestions(uow, REGISTRY, SystemClock())(region, cold_start=5)
        batch = AnswerHotelierQuestions(uow, FakeLLM(REGISTRY), answer)

        result = await batch(hotel, "Можно с собаками до 10 кг, доплата 2500 рублей")
        overview = await GetHotelierCabinet(uow, REGISTRY, SystemClock())(hotel)

        assert queued == 3
        assert [item.question_id for item in result.applied] == [f"q_{hotel}_pets_policy"]
        assert len(result.untouched) == 2
        assert len(overview.questions) == 2
    finally:
        await uow.aclose()
