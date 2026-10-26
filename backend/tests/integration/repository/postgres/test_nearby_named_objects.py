import os
from dataclasses import replace

import psycopg

from hotel_agent.adapters.db.nearby_objects import PostgresNearbyObjectRepository
from hotel_agent.domain.query import NearbyObjectRequest


async def test_named_chain_matches_only_objects_carrying_that_name() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        repository = PostgresNearbyObjectRepository(connection)
        category = NearbyObjectRequest(
            osm_key="shop",
            osm_value="*",
            open_24h=False,
            radius_m=1500,
            source_text="магазин рядом",
        )
        row = await connection.execute(
            """SELECT p.region_id, p.tags->>'name', ST_X(p.location), ST_Y(p.location)
            FROM pois p WHERE p.region_id = 'sochi' AND p.tags ? 'shop'
              AND NULLIF(trim(p.tags->>'name'), '') IS NOT NULL LIMIT 1"""
        )
        found = await row.fetchone()
        assert found, "Run make seed before integration tests"
        region, name = str(found[0]), str(found[1])
        lon, lat = float(found[2]), float(found[3])
        bbox = (lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02)

        any_shop = await repository.list_matches(region, category, bbox)
        named = await repository.list_matches(region, replace(category, name=name), bbox)
        absent = await repository.list_matches(
            region, replace(category, name="Несуществующая сеть Ящик"), bbox
        )

        assert any(ids for ids in any_shop.values())
        assert any(ids for ids in named.values())
        assert sum(len(ids) for ids in named.values()) <= sum(len(ids) for ids in any_shop.values())
        assert not any(ids for ids in absent.values())
    finally:
        await connection.rollback()
        await connection.close()
