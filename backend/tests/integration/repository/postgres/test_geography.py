import json
import os
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg

from hotel_agent.adapters.db.geography import PostgresGeography
from hotel_agent.adapters.db.search import PostgresSearchRepository
from hotel_agent.adapters.osm.geography_snapshot import parse_snapshot
from hotel_agent.application.ports.geography import HotelTags

EXTRACT = Path(__file__).resolve().parents[3] / "fixtures/geography.osm"
BBOX = (10.0, 50.0, 10.005, 50.005)


async def test_geography_persists_layers_links_hotel_and_survives_adapter_recreation() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        snapshot = parse_snapshot(EXTRACT.read_bytes(), BBOX, "https://example.test/api")
        repo = PostgresGeography(connection)
        assert await repo.cached(BBOX, snapshot.fetched_at) is None
        await repo.save(snapshot, "geography-test")
        await repo.save(snapshot, "geography-test")
        cached = await PostgresGeography(connection).cached(BBOX, snapshot.fetched_at)
        assert cached is not None and cached.complete
        assert {item.id for item in cached.buildings} == {"w10", "w11"}
        hotel = await PostgresSearchRepository(connection).get_hotel("n5")
        assert hotel is not None and hotel.building_id == "w10"
        assert hotel.height_m == 25 and hotel.levels == 7
        row = await (await connection.execute("SELECT tags FROM hotels WHERE id='n5'")).fetchone()
        assert row is not None and isinstance(row[0], dict)
        assert row[0]["breakfast"] == "yes"
        assert await (
            await connection.execute("SELECT count(*) FROM beaches WHERE id='r20'")
        ).fetchone() == (1,)
        assert await repo.cached(BBOX, snapshot.fetched_at + timedelta(days=31)) is None
        assert await repo.cached((10, 50, 10.01, 50.01), snapshot.fetched_at) is None
        assert (
            await repo.merge_hotel_tags(
                (
                    HotelTags("n5", {"internet_access": "wlan"}),
                    HotelTags("not-a-local-hotel", {"tourism": "hotel"}),
                )
            )
            == 1
        )
        updated = await PostgresSearchRepository(connection).get_hotel("n5")
        assert updated == hotel
        row = await (
            await connection.execute("SELECT text FROM hotel_search_documents WHERE id='osm:n5'")
        ).fetchone()
        assert row is not None
        assert json.loads(str(row[0]))["internet_access"] == "wlan"
    finally:
        await connection.rollback()
        await connection.close()


async def test_partial_geography_never_claims_complete_coverage_and_expires_quickly() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        snapshot = replace(
            parse_snapshot(EXTRACT.read_bytes(), BBOX, "https://example.test/api"), complete=False
        )
        repo = PostgresGeography(connection)
        await repo.save(snapshot, "geography-test")
        cached = await repo.cached(BBOX, snapshot.fetched_at)
        assert cached is not None and not cached.complete
        assert await repo.cached(BBOX, snapshot.fetched_at + timedelta(minutes=6)) is None
    finally:
        await connection.rollback()
        await connection.close()


async def test_height_refresh_keeps_source_measurement_and_retires_legacy_guesses() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        repo = PostgresGeography(connection)
        await repo.save(
            parse_snapshot(EXTRACT.read_bytes(), BBOX, "https://example.test/api"), "geography-test"
        )
        await connection.execute("""INSERT INTO buildings(id,region_id,footprint,tags,height_m)
        VALUES ('legacy-guess','geography-test',ST_MakeEnvelope(10.003,50.003,10.004,50.004,4326),
        '{"building":"yes"}',9.6)""")
        await connection.execute("""INSERT INTO hotels(id,region_id,name,location,building_id)
        VALUES ('legacy-hotel','geography-test','Legacy',ST_SetSRID(ST_MakePoint(10.003,50.003),4326),'legacy-guess')""")
        await connection.execute("""INSERT INTO facts(id,subject_type,subject_id,characteristic_key,
        value,source_type,source_id,method,confidence,computed_at,status)
        VALUES ('f_height_legacy-hotel','hotel','legacy-hotel','building_height','9.6',
        'computed','legacy-guess','building_height@1',0.3,now(),'active')""")
        result = await repo.refresh_heights("geography-test", datetime.now(UTC))
        assert result == {
            "explicit_height_facts": 1,
            "guesses_retired": 1,
            "guessed_scalars_cleared": 1,
        }
        measured = await (
            await connection.execute("SELECT value,method,status FROM facts WHERE id='f_height_n5'")
        ).fetchone()
        assert measured == (25, "osm_building_height@1", "active")
        guessed = await (
            await connection.execute(
                "SELECT b.height_m,f.status FROM buildings b JOIN facts f ON f.source_id=b.id WHERE b.id='legacy-guess'"
            )
        ).fetchone()
        assert guessed == (None, "stale")
        await connection.execute(
            "UPDATE facts SET source_type='hotelier',status='confirmed_by_hotelier',value='20' WHERE id='f_height_n5'"
        )
        assert (await repo.refresh_heights("geography-test", datetime.now(UTC)))[
            "explicit_height_facts"
        ] == 0
        assert await (
            await connection.execute("SELECT value FROM facts WHERE id='f_height_n5'")
        ).fetchone() == (20,)
    finally:
        await connection.rollback()
        await connection.close()
