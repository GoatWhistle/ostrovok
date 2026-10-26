import os

import psycopg

from hotel_agent.adapters.db.search import PostgresSearchRepository


async def test_requested_fact_filters_match_hotel_and_characteristic_without_global_load() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        repository = PostgresSearchRepository(connection)
        rows = await repository.list_facts("sochi")
        assert rows, "Run make seed and make precompute before integration tests"
        sample = next(row for row in rows if not row.characteristic_key.startswith("derived:"))
        filtered = await repository.list_facts(
            None, hotel_ids=(sample.hotel_id,), characteristic_keys=(sample.characteristic_key,)
        )
        assert {row.id for row in filtered} == {
            row.id
            for row in rows
            if row.hotel_id == sample.hotel_id
            and row.characteristic_key == sample.characteristic_key
        }
        assert (
            await repository.list_facts(
                None, hotel_ids=(), characteristic_keys=(sample.characteristic_key,)
            )
            == []
        )
    finally:
        await connection.rollback()
        await connection.close()


async def test_comparison_retains_stale_evidence_but_requested_native_checks_exclude_it() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        repository = PostgresSearchRepository(connection)
        sample = next(iter(await repository.list_facts("sochi")))
        await connection.execute("UPDATE facts SET status='stale' WHERE id=%s", (sample.id,))
        comparison = await repository.list_facts(None, hotel_ids=(sample.hotel_id,))
        requested = await repository.list_facts(
            None, hotel_ids=(sample.hotel_id,), characteristic_keys=(sample.characteristic_key,)
        )
        assert any(row.id == sample.id and row.status == "stale" for row in comparison)
        assert all(row.id != sample.id for row in requested)
    finally:
        await connection.rollback()
        await connection.close()
