import json
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Self

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from hotel_agent.application.dto import Feature

TABLES = {
    "buildings": ("buildings", "footprint", "ST_Multi(ST_GeomFromGeoJSON(geometry_json))"),
    "hotels": ("hotels", "location", "ST_GeomFromGeoJSON(geometry_json)"),
    "pois": ("pois", "location", "ST_GeomFromGeoJSON(geometry_json)"),
    "coastline": ("coastline", "geometry", "ST_Multi(ST_GeomFromGeoJSON(geometry_json))"),
    "beaches": ("beaches", "geometry", "ST_Multi(ST_GeomFromGeoJSON(geometry_json))"),
    "noise_sources": ("noise_sources", "geometry", "ST_Multi(ST_GeomFromGeoJSON(geometry_json))"),
    "walk": ("walk_edges", "geometry", "ST_Multi(ST_GeomFromGeoJSON(geometry_json))"),
}


class PostgresSeedWriter:
    def __init__(self, pool: AsyncConnectionPool[AsyncConnection[tuple[object, ...]]]) -> None:
        self._pool = pool
        self._connection: AsyncConnection[tuple[object, ...]] | None = None

    async def __aenter__(self) -> Self:
        self._connection = await self._pool.getconn()
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._connection is not None:
            await self._connection.rollback()
            await self._pool.putconn(self._connection)
            self._connection = None

    def _db(self) -> AsyncConnection[tuple[object, ...]]:
        if self._connection is None:
            raise RuntimeError("Seed writer is not open")
        return self._connection

    async def upsert_region(self, region: str, meta: Mapping[str, object]) -> None:
        bbox = meta["bbox"]
        if not isinstance(bbox, list) or len(bbox) != 4:
            raise ValueError("Seed metadata bbox must contain four coordinates")
        built_at = datetime.fromisoformat(str(meta["built_at"]))
        await self._db().execute(
            """INSERT INTO regions (id, name, bbox, built_at)
            VALUES (%(id)s, %(name)s, ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326), %(built_at)s)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                bbox = EXCLUDED.bbox, built_at = EXCLUDED.built_at""",
            {
                "id": region,
                "name": {"sochi": "Сочи", "russia": "Россия"}.get(region, region),
                "west": bbox[0],
                "south": bbox[1],
                "east": bbox[2],
                "north": bbox[3],
                "built_at": built_at,
            },
        )

    async def save_layer(self, region: str, name: str, features: Sequence[Feature]) -> int:
        table, geometry_column, geometry_sql = TABLES[name]
        db = self._db()
        await db.execute(
            "CREATE TEMP TABLE seed_stage (id text, geometry_json text, tags_json text) ON COMMIT DROP"
        )
        async with (
            db.cursor() as cursor,
            cursor.copy("COPY seed_stage (id, geometry_json, tags_json) FROM STDIN") as copy,
        ):
            for feature in features:
                await copy.write_row(
                    (
                        feature.id,
                        json.dumps(feature.geometry, separators=(",", ":")),
                        json.dumps(feature.properties, ensure_ascii=False, separators=(",", ":")),
                    )
                )
        if name == "hotels":
            await db.execute(
                f"""INSERT INTO hotels (id, region_id, name, location, stars, tags)
                SELECT id, %(region)s, COALESCE(tags_json::jsonb->>'name', id),
                       {geometry_sql},
                       CASE WHEN tags_json::jsonb->>'stars' ~ '^[0-9]+$'
                            THEN (tags_json::jsonb->>'stars')::integer ELSE NULL END,
                       tags_json::jsonb
                FROM seed_stage
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                    location = EXCLUDED.location, stars = EXCLUDED.stars, tags = EXCLUDED.tags""",
                {"region": region},
            )
        else:
            await db.execute(
                f"""INSERT INTO {table} (id, region_id, {geometry_column}, tags)
                SELECT id, %(region)s, {geometry_sql}, tags_json::jsonb FROM seed_stage
                ON CONFLICT (id) DO UPDATE SET {geometry_column} = EXCLUDED.{geometry_column},
                    tags = EXCLUDED.tags""",
                {"region": region},
            )
        await db.execute("DROP TABLE seed_stage")
        return len(features)

    async def link_hotels(self, region: str) -> int:
        db = self._db()
        await db.execute(
            """UPDATE hotels h SET building_id = (
                SELECT b.id FROM buildings b
                WHERE b.region_id = %(region)s
                  AND ST_DWithin(b.footprint::geography, h.location::geography, 30)
                ORDER BY ST_Distance(b.footprint::geography, h.location::geography), b.id
                LIMIT 1
            ) WHERE h.region_id = %(region)s""",
            {"region": region},
        )
        result = await db.execute(
            "SELECT count(*) FROM hotels WHERE region_id = %(region)s AND building_id IS NOT NULL",
            {"region": region},
        )
        row = await result.fetchone()
        return int(str(row[0])) if row else 0

    async def commit(self) -> None:
        await self._db().commit()
