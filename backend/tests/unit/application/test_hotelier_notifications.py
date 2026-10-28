from collections.abc import Sequence
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import DemandRecord, NotificationRecord, SearchHotelRecord
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.hotelier_notifications import (
    ListHotelierNotifications,
    MarkNotificationsRead,
)
from hotel_agent.application.use_cases.sweep_notifications import SweepHotelierNotifications
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery
from hotel_agent.domain.notifications import NotificationKind
from tests.unit.application.hotelier_fakes import (
    NOW,
    FixedClock,
    Ids,
    Store,
    computed_fact,
    factory,
    question,
)

REGION = "sochi"
HOTEL = SearchHotelRecord(
    id="h1",
    region_id=REGION,
    name="Hotel h1",
    location=(39.72, 43.58),
    stars=4,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def feed(store: Store, kind: str) -> list[NotificationRecord]:
    return [item for item in store.notifications.values() if item.kind == kind]


def sweep(store: Store, registry: YamlCharacteristicRegistry) -> SweepHotelierNotifications:
    return SweepHotelierNotifications(factory(store), registry, FixedClock())


def demand(blocked: int, key: str = "pets_policy", hotel: str = "h1") -> Sequence[DemandRecord]:
    return [
        DemandRecord(
            hotel_id=hotel, characteristic_key=key, appearances=blocked + 4, blocked=blocked
        )
    ]


async def test_an_accepted_answer_lands_in_the_feed(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    answer = AnswerHotelierQuestion(
        factory(store), registry, FakeLLM(registry), FixedClock(), Ids()
    )

    await answer("q1", "С собаками до 10 кг, доплата 2500 рублей")

    accepted = feed(store, "answer_accepted")
    assert len(accepted) == 1
    assert accepted[0].hotel_id == "h1"
    assert accepted[0].question_id == "q1"
    assert accepted[0].fact_id is not None
    assert accepted[0].severity == "info"


async def test_an_answer_without_facts_asks_for_detail(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    answer = AnswerHotelierQuestion(
        factory(store), registry, FakeLLM(registry), FixedClock(), Ids()
    )

    await answer("q1", "здравствуйте")

    detail = feed(store, "answer_needs_detail")
    assert len(detail) == 1
    assert detail[0].severity == "action"
    assert feed(store, "answer_accepted") == []


async def test_a_value_about_to_expire_reaches_its_hotel(
    registry: YamlCharacteristicRegistry,
) -> None:
    fact = replace(
        computed_fact("f1", "h1", "sunset_view", True),
        valid_until=NOW + timedelta(days=3),
    )
    store = Store(facts={"f1": fact})

    report = await sweep(store, registry)(REGION)

    expiring = feed(store, "fact_expiring")
    assert (report.expiring, report.written) == (1, 1)
    assert expiring[0].fact_id == "f1"
    assert expiring[0].severity == "info"
    assert expiring[0].payload["days_left"] == 3.0


async def test_an_expiring_hotelier_statement_asks_to_be_reconfirmed(
    registry: YamlCharacteristicRegistry,
) -> None:
    fact = replace(
        computed_fact("f1", "h1", "pets_policy", True, status="confirmed_by_hotelier"),
        valid_until=NOW + timedelta(days=1),
    )
    store = Store(facts={"f1": fact})

    await sweep(store, registry)(REGION)

    assert feed(store, "fact_expiring")[0].severity == "action"


async def test_a_value_with_a_long_life_is_left_alone(
    registry: YamlCharacteristicRegistry,
) -> None:
    fact = replace(
        computed_fact("f1", "h1", "sunset_view", True),
        valid_until=NOW + timedelta(days=200),
    )
    store = Store(facts={"f1": fact})

    report = await sweep(store, registry)(REGION)

    assert (report.expiring, report.written) == (0, 0)


async def test_blocked_searches_become_one_message_per_day(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=list(demand(7)))

    first = await sweep(store, registry)(REGION)
    again = await sweep(store, registry)(REGION)

    demands = feed(store, "search_demand")
    assert (first.written, again.written) == (1, 0)
    assert demands[0].characteristic_key == "pets_policy"
    assert demands[0].payload["blocked_searches"] == 7
    assert demands[0].payload["window_days"] == 14
    assert demands[0].severity == "action"


async def test_demand_for_a_characteristic_no_one_can_answer_is_ignored(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = Store(demand=list(demand(9, key="noise_level")))

    report = await sweep(store, registry)(REGION)

    assert (report.demand, report.written) == (0, 0)


def seeded() -> Store:
    store = Store(questions={"q1": question("q1", "h1", "pets_policy")})
    store.hotel_records["h1"] = HOTEL
    return store


async def test_the_feed_explains_each_entry(registry: YamlCharacteristicRegistry) -> None:
    store = seeded()
    answer = AnswerHotelierQuestion(
        factory(store), registry, FakeLLM(registry), FixedClock(), Ids()
    )
    await answer("q1", "С собаками до 10 кг, доплата 2500 рублей")

    feed = await ListHotelierNotifications(factory(store), registry)("h1")

    assert len(feed.items) == 1
    item = feed.items[0]
    assert item.title == "Размещение с животными"
    assert item.question_text == "?"
    assert item.notification.kind is NotificationKind.ANSWER_ACCEPTED
    assert feed.unread.total == 1
    assert feed.next_cursor is None


async def test_the_feed_can_show_only_what_is_unread(
    registry: YamlCharacteristicRegistry,
) -> None:
    store = seeded()
    answer = AnswerHotelierQuestion(
        factory(store), registry, FakeLLM(registry), FixedClock(), Ids()
    )
    await answer("q1", "С собаками до 10 кг")
    read = MarkNotificationsRead(factory(store), FixedClock())

    changed = await read("h1")
    feed = await ListHotelierNotifications(factory(store), registry)("h1", unread_only=True)

    assert changed == 1
    assert feed.items == ()
    assert feed.unread.total == 0


async def test_a_page_size_outside_the_contract_is_refused(
    registry: YamlCharacteristicRegistry,
) -> None:
    listing = ListHotelierNotifications(factory(seeded()), registry)

    with pytest.raises(InvalidQuery):
        await listing("h1", limit=0)
    with pytest.raises(InvalidQuery):
        await listing("h1", limit=101)


async def test_the_feed_belongs_to_a_known_hotel(registry: YamlCharacteristicRegistry) -> None:
    store = seeded()

    with pytest.raises(HotelNotFound):
        await ListHotelierNotifications(factory(store), registry)("missing")
    with pytest.raises(HotelNotFound):
        await MarkNotificationsRead(factory(store), FixedClock())("missing")
