from datetime import UTC, datetime, timedelta

import psycopg
import pytest

from hotel_agent.adapters.db.notifications import PostgresNotificationStore
from hotel_agent.application.dto import NotificationRecord
from tests.integration.repository.postgres.hotelier_setup import seed_hotel

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)


def record(
    hotel_id: str,
    tag: str,
    *,
    kind: str = "question_opened",
    severity: str = "action",
    dedup: str | None = None,
    minutes: int = 0,
    payload: dict[str, object] | None = None,
) -> NotificationRecord:
    return NotificationRecord(
        id=f"n_{hotel_id}_{tag}",
        hotel_id=hotel_id,
        kind=kind,
        severity=severity,
        created_at=NOW + timedelta(minutes=minutes),
        dedup_key=dedup or tag,
        characteristic_key="pets_policy",
        question_id="q_1",
        payload=payload or {},
    )


async def test_the_same_event_is_stored_once(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        store = PostgresNotificationStore(connection)

        first = await store.add([record(hotel, "1", dedup="fact_expiring|f_1")])
        again = await store.add([record(hotel, "1", dedup="fact_expiring|f_1", minutes=30)])
        await connection.commit()

        assert (first, again) == (1, 0)
        page = await store.page(hotel)
        assert [item.id for item in page.items] == [f"n_{hotel}_1"]


async def test_the_feed_is_newest_first_and_pages_by_cursor(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        store = PostgresNotificationStore(connection)
        await store.add([record(hotel, str(index), minutes=index) for index in range(5)])
        await connection.commit()

        first = await store.page(hotel, limit=2)
        second = await store.page(hotel, limit=2, cursor=first.next_cursor)
        last = await store.page(hotel, limit=2, cursor=second.next_cursor)

        assert [item.id for item in first.items] == [f"n_{hotel}_4", f"n_{hotel}_3"]
        assert [item.id for item in second.items] == [f"n_{hotel}_2", f"n_{hotel}_1"]
        assert [item.id for item in last.items] == [f"n_{hotel}_0"]
        assert last.next_cursor is None


async def test_unread_counters_separate_what_needs_action(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        store = PostgresNotificationStore(connection)
        await store.add(
            [
                record(hotel, "1"),
                record(hotel, "2", minutes=1),
                record(hotel, "3", kind="answer_accepted", severity="info", minutes=2),
            ]
        )
        await connection.commit()

        counters = await store.unread_counts(hotel)

        assert counters.total == 3
        assert counters.action == 2
        assert counters.by_kind == {"question_opened": 2, "answer_accepted": 1}


async def test_reading_is_per_hotel_and_idempotent(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    _, other = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        store = PostgresNotificationStore(connection)
        await store.add([record(hotel, "1"), record(hotel, "2", minutes=1)])
        await store.add([record(other, "3")])
        await connection.commit()

        read = await store.mark_read(
            hotel, [f"n_{hotel}_1", f"n_{other}_3"], NOW + timedelta(hours=1)
        )
        twice = await store.mark_read(hotel, [f"n_{hotel}_1"], NOW + timedelta(hours=2))
        rest = await store.mark_all_read(hotel, NOW + timedelta(hours=3))
        await connection.commit()

        assert (read, twice, rest) == (1, 0, 1)
        assert (await store.unread_counts(hotel)).total == 0
        assert (await store.unread_counts(other)).total == 1
        unread_only = await store.page(hotel, unread_only=True)
        assert unread_only.items == ()


async def test_the_payload_survives_storage(disposable_database: str) -> None:
    _, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        store = PostgresNotificationStore(connection)
        await store.add([record(hotel, "1", payload={"blocked_searches": 7, "window_days": 14})])
        await connection.commit()

        page = await store.page(hotel)

        assert page.items[0].payload == {"blocked_searches": 7, "window_days": 14}
