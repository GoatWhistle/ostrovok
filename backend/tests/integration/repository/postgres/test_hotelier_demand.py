import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import psycopg
import pytest

from hotel_agent.adapters.db.hotelier_demand import PostgresHotelierDemand
from tests.integration.repository.postgres.hotelier_setup import seed_hotel

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)
SINCE = NOW - timedelta(days=14)


def snapshot(hotel_id: str, matched: list[tuple[str, str]]) -> str:
    return json.dumps(
        {
            "results": [
                {
                    "hotel": {"id": hotel_id, "name": "Integration hotel"},
                    "score": 0.5,
                    "matched": [
                        {"characteristic_key": key, "match": quality} for key, quality in matched
                    ],
                }
            ]
        }
    )


async def record_search(
    url: str, region: str, hotel_id: str, matched: list[tuple[str, str]], age_days: float = 1.0
) -> None:
    async with await psycopg.AsyncConnection.connect(url) as connection:
        await connection.execute(
            """INSERT INTO chat_conversations(id, region_id, effective_query, created_at,
                updated_at, search_snapshot)
            VALUES (%(id)s, %(region)s, 'тихо и с собакой', %(at)s, %(at)s, %(snapshot)s)""",
            {
                "id": str(uuid4()),
                "region": region,
                "at": NOW - timedelta(days=age_days),
                "snapshot": snapshot(hotel_id, matched),
            },
        )
        await connection.commit()


async def test_an_unknown_value_in_a_real_search_becomes_demand(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(
        disposable_database, region, hotel, [("pets_policy", "unknown"), ("noise_level", "full")]
    )
    await record_search(disposable_database, region, hotel, [("pets_policy", "unknown")])
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        demand = PostgresHotelierDemand(connection)

        counts = await demand.unknown_counts(region, ["pets_policy", "noise_level"], SINCE)

        assert [(item.characteristic_key, item.blocked) for item in counts] == [("pets_policy", 2)]
        assert counts[0].hotel_id == hotel
        assert counts[0].appearances == 2


async def test_a_satisfied_characteristic_raises_no_demand(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(disposable_database, region, hotel, [("pets_policy", "full")])
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        demand = PostgresHotelierDemand(connection)

        assert await demand.unknown_counts(region, ["pets_policy"], SINCE) == []


async def test_demand_outside_the_window_or_region_is_ignored(
    disposable_database: str,
) -> None:
    region, hotel = await seed_hotel(disposable_database)
    other, _ = await seed_hotel(disposable_database)
    await record_search(
        disposable_database, region, hotel, [("pets_policy", "unknown")], age_days=40.0
    )
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        demand = PostgresHotelierDemand(connection)

        assert await demand.unknown_counts(region, ["pets_policy"], SINCE) == []
        assert await demand.unknown_counts(other, ["pets_policy"], SINCE) == []


async def test_the_cabinet_sees_its_own_appearances(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    await record_search(
        disposable_database, region, hotel, [("pets_policy", "unknown"), ("sunset_view", "partial")]
    )
    await record_search(disposable_database, region, hotel, [("sunset_view", "full")])
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        demand = PostgresHotelierDemand(connection)

        rows = await demand.for_hotel(hotel, SINCE)
        appearances = await demand.appearances(hotel, SINCE)

        assert appearances == 2
        assert {item.characteristic_key: (item.appearances, item.blocked) for item in rows} == {
            "pets_policy": (1, 1),
            "sunset_view": (2, 0),
        }


async def test_a_search_without_results_breaks_nothing(disposable_database: str) -> None:
    region, hotel = await seed_hotel(disposable_database)
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        await connection.execute(
            """INSERT INTO chat_conversations(id, region_id, created_at, updated_at,
                search_snapshot)
            VALUES (%(id)s, %(region)s, %(at)s, %(at)s, %(snapshot)s)""",
            {
                "id": str(uuid4()),
                "region": region,
                "at": NOW,
                "snapshot": json.dumps({"results": []}),
            },
        )
        await connection.execute(
            """INSERT INTO chat_conversations(id, region_id, created_at, updated_at)
            VALUES (%(id)s, %(region)s, %(at)s, %(at)s)""",
            {"id": str(uuid4()), "region": region, "at": NOW},
        )
        await connection.commit()
        demand = PostgresHotelierDemand(connection)

        assert await demand.unknown_counts(region, ["pets_policy"], SINCE) == []
        assert await demand.appearances(hotel, SINCE) == 0
