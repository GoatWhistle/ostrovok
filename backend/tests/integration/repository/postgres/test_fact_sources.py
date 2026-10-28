from uuid import uuid4

import psycopg
import pytest
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.precompute import PostgresPrecompute
from hotel_agent.application.use_cases.precompute import Precompute

pytestmark = pytest.mark.anyio

OSM = "osm:south-fed-district-latest.osm.pbf"
DEM = "dem:Copernicus GLO-30 Copernicus_DSM_COG_10_N43_00_E039_00_DEM.tif"


async def seed_osm_hotel(url: str, building: str) -> tuple[str, str]:
    tag = uuid4().hex[:10]
    region, hotel = f"src_{tag}", f"h_{tag}"
    async with await psycopg.AsyncConnection.connect(url) as connection:
        await connection.execute(
            """INSERT INTO regions(id, name, bbox, built_at)
            VALUES (%(region)s, 'Sources', ST_MakeEnvelope(39, 43, 40, 44, 4326), now())""",
            {"region": region},
        )
        await connection.execute(
            """INSERT INTO buildings(id, region_id, footprint, tags)
            VALUES (%(building)s, %(region)s,
                ST_Multi(ST_MakeEnvelope(39.5, 43.5, 39.5001, 43.5001, 4326)),
                '{"building":"hotel","building:levels":"5"}')""",
            {"building": building, "region": region},
        )
        await connection.execute(
            """INSERT INTO hotels(id, region_id, name, location, building_id)
            VALUES (%(hotel)s, %(region)s, 'Source hotel',
                ST_SetSRID(ST_MakePoint(39.50005, 43.50005), 4326), %(building)s)""",
            {"hotel": hotel, "region": region, "building": building},
        )
        await connection.commit()
    return region, hotel


async def provenance(url: str, hotel_id: str) -> tuple[str | None, list[str]]:
    async with await psycopg.AsyncConnection.connect(url) as connection:
        cursor = await connection.execute(
            """SELECT source_url, evidence FROM facts
            WHERE subject_id = %(hotel)s AND characteristic_key = 'building_height'""",
            {"hotel": hotel_id},
        )
        row = await cursor.fetchone()
    assert row is not None
    evidence = row[1] if isinstance(row[1], list) else []
    return (
        str(row[0]) if row[0] is not None else None,
        [str(item.get("text")) for item in evidence if item.get("kind") == "dataset"],
    )


async def run(url: str, region: str, osm: str = OSM, dem: str = DEM) -> None:
    async with AsyncConnectionPool(url, min_size=1, max_size=1, open=False) as pool:
        precompute = Precompute(PostgresPrecompute(pool))
        await precompute(region)
        await precompute.stamp(region, osm, dem)


async def test_a_computed_fact_names_the_datasets_it_came_from(
    disposable_database: str,
) -> None:
    region, hotel = await seed_osm_hotel(disposable_database, "w51352167")

    await run(disposable_database, region)
    await run(disposable_database, region)

    source_url, datasets = await provenance(disposable_database, hotel)

    assert datasets == [OSM, DEM]
    assert source_url == "https://www.openstreetmap.org/way/51352167"


async def test_a_building_without_an_osm_identifier_gets_no_link(
    disposable_database: str,
) -> None:
    region, hotel = await seed_osm_hotel(disposable_database, "b_local_1")

    await run(disposable_database, region)

    source_url, datasets = await provenance(disposable_database, hotel)

    assert source_url is None
    assert datasets == [OSM, DEM]


async def test_without_dataset_names_nothing_is_stamped(disposable_database: str) -> None:
    region, hotel = await seed_osm_hotel(disposable_database, "n777")

    await run(disposable_database, region, osm="", dem="")

    source_url, datasets = await provenance(disposable_database, hotel)

    assert datasets == []
    assert source_url == "https://www.openstreetmap.org/node/777"
