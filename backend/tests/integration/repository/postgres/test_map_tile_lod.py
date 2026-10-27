import math
from typing import Any

import mapbox_vector_tile
import psycopg
import pytest
from psycopg_pool import AsyncConnectionPool
from shapely.geometry import shape

from hotel_agent.adapters.db.map_tiles import PostgresMapTileRepository

Pool = AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]]


def tile_at(z: int, lon: float, lat: float) -> tuple[int, int]:
    return (
        int((lon + 180) / 360 * 2**z),
        int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z),
    )


async def seed(connection: psycopg.AsyncConnection[tuple[object, ...]]) -> None:
    await connection.execute(
        """
        INSERT INTO buildings(id,region_id,footprint,class,class_source,height_m,height_source)
        VALUES ('lod-house','test',ST_Multi(ST_MakeEnvelope(39.719,43.579,39.721,43.581,4326)),
            'hotel','hotel',12,'levels'),
        ('lod-small','test',ST_Multi(ST_MakeEnvelope(39.721,43.581,39.72104,43.58104,4326)),
            'house','tag',3,'default')
        """
    )


def features(payload: bytes, layer: str = "buildings") -> list[dict[str, Any]]:
    decoded: dict[str, Any] = mapbox_vector_tile.decode(payload)
    return list(decoded[layer]["features"]) if layer in decoded else []


@pytest.mark.parametrize("z", [10, 11, 12, 13, 14, 15, 16, 17])
async def test_building_keeps_identity_and_valid_geometry_at_overview(
    catalog_pool: Pool, z: int
) -> None:
    async with catalog_pool.connection() as connection:
        await seed(connection)
        x, y = tile_at(z, 39.72, 43.58)
        items = features(await PostgresMapTileRepository(connection).get(z, x, y))
        house = next(item for item in items if item["properties"]["id"] == "lod-house")
        assert house["properties"]["class"] == "hotel"
        assert house["properties"]["class_source"] == "hotel"
        assert house["properties"]["height_source"] == "levels"
        assert house["properties"]["height_m"] == 12
        polygon = shape(house["geometry"])
        assert polygon.is_valid and polygon.area > 0
        assert all(-64 <= value <= 4160 for value in polygon.bounds)
        if z < 12:
            assert all(item["properties"]["id"] != "lod-small" for item in items)


async def test_tile_border_preserves_both_halves_and_updates_generated_geometry(
    catalog_pool: Pool,
) -> None:
    async with catalog_pool.connection() as connection:
        await connection.execute(
            """
            INSERT INTO buildings(id,region_id,footprint)
            SELECT 'border','test',ST_Multi(ST_Transform(ST_Buffer(
                ST_SetSRID(ST_MakePoint(ST_XMax(g), (ST_YMin(g)+ST_YMax(g))/2),3857),
                30),4326))
            FROM (SELECT ST_TileEnvelope(14,9999,5983) g) tile
            """
        )
        repo = PostgresMapTileRepository(connection)
        left = features(await repo.get(14, 9999, 5983))[0]
        right = features(await repo.get(14, 10000, 5983))[0]
        assert left["properties"]["id"] == right["properties"]["id"] == "border"
        assert shape(left["geometry"]).is_valid and shape(right["geometry"]).is_valid
        await connection.execute(
            "UPDATE buildings SET footprint=ST_Translate(footprint,1,1) WHERE id='border'"
        )
        assert not features(await repo.get(14, 9999, 5983))
        assert not features(await repo.get(14, 10000, 5983))


async def test_low_zoom_uses_real_settlement_polygons_and_empty_area_stays_empty(
    catalog_pool: Pool,
) -> None:
    async with catalog_pool.connection() as connection:
        await connection.execute(
            """
            INSERT INTO landcover(id,region_id,geometry,class,class_source)
            VALUES ('settlement','test',ST_Multi(ST_MakeEnvelope(39.7,43.5,39.8,43.6,4326)),
                'residential','tag')
            """
        )
        repo = PostgresMapTileRepository(connection)
        for z in [6, 8, 10, 11]:
            x, y = tile_at(z, 39.72, 43.58)
            items = features(await repo.get(z, x, y), "landcover")
            assert items[0]["properties"]["id"] == "settlement"
            assert items[0]["properties"]["class"] == "residential"
        assert await repo.get(12, 0, 0) == b""
