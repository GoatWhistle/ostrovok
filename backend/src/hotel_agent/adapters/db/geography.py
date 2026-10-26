import hashlib
import json
from collections.abc import Sequence
from datetime import datetime, timedelta

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.adapters.db.building_facts import refresh_heights
from hotel_agent.adapters.db.geography_rows import save_layer
from hotel_agent.application.ports.geography import GeographicBounds, GeographySnapshot, HotelTags
from hotel_agent.application.ports.view_geometry import PhysicalArea, PhysicalObject

COVERAGE_SQL = """SELECT complete,source_url FROM geography_coverage
WHERE valid_until > %(now)s AND ST_Covers(bbox,
 ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326))
ORDER BY complete DESC, fetched_at DESC LIMIT 1"""

BUILDINGS_SQL = """SELECT id,ST_AsGeoJSON(footprint),tags FROM buildings
WHERE footprint && ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326)
ORDER BY id LIMIT 20001"""

REGION_SQL = """INSERT INTO regions(id,name,bbox,built_at)
VALUES (%(region)s,%(region)s,ST_MakeEnvelope(-180,41,180,82,4326),%(now)s)
ON CONFLICT(id) DO NOTHING"""

LINK_SQL = """UPDATE hotels h SET building_id=(
 SELECT b.id FROM buildings b
 WHERE b.footprint && ST_Expand(h.location,0.001)
 AND ST_DWithin(b.footprint::geography,h.location::geography,30)
 AND COALESCE(b.tags->>'building:part','no') = 'no'
 ORDER BY (b.id=h.id) DESC,ST_Distance(b.footprint::geography,h.location::geography),b.id LIMIT 1)
WHERE h.building_id IS NULL AND h.location &&
 ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326)"""

SAVE_COVERAGE_SQL = """INSERT INTO geography_coverage
(id,bbox,source_url,fetched_at,valid_until,complete,counts)
VALUES (%(id)s,ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326),
 %(source)s,%(now)s,%(until)s,%(complete)s,%(counts)s)
ON CONFLICT(id) DO UPDATE SET source_url=EXCLUDED.source_url,
 fetched_at=EXCLUDED.fetched_at,valid_until=EXCLUDED.valid_until,
 complete=EXCLUDED.complete,counts=EXCLUDED.counts"""

HOTEL_TAGS_SQL = """UPDATE hotels h SET tags=h.tags || incoming.tags,
name=COALESCE(NULLIF(incoming.tags->>'name',''),
 CASE WHEN h.name=h.id THEN COALESCE(NULLIF(incoming.tags->>'name:ru',''),
 NULLIF(incoming.tags->>'name:en','')) END,h.name)
FROM jsonb_to_recordset(%(records)s::jsonb) AS incoming(id text,tags jsonb)
WHERE h.id=incoming.id"""


class PostgresGeography:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def cached(self, bbox: GeographicBounds, now: datetime) -> PhysicalArea | None:
        params = _bounds(bbox) | {"now": now}
        cursor = await self._connection.execute(COVERAGE_SQL, params)
        coverage = await cursor.fetchone()
        if coverage is None:
            return None
        cursor = await self._connection.execute(BUILDINGS_SQL, params)
        rows = await cursor.fetchall()
        buildings = tuple(
            PhysicalObject(
                str(row[0]),
                {str(k): str(v) for k, v in row[2].items()} if isinstance(row[2], dict) else {},
                json.loads(str(row[1])),
                str(coverage[1]),
            )
            for row in rows[:20000]
        )
        return PhysicalArea(
            bbox, buildings, bool(coverage[0]) and len(rows) <= 20000, str(coverage[1])
        )

    async def save(self, snapshot: GeographySnapshot, region: str) -> None:
        params = _bounds(snapshot.bbox) | {"region": region, "now": snapshot.fetched_at}
        await self._connection.execute(REGION_SQL, params)
        for name in snapshot.layers.names():
            features = getattr(snapshot.layers, name)
            if features:
                await save_layer(self._connection, region, name, features)
        await self._connection.execute(LINK_SQL, params)
        await self._connection.execute(
            SAVE_COVERAGE_SQL,
            params
            | {
                "id": hashlib.sha256(json.dumps(snapshot.bbox).encode()).hexdigest(),
                "source": snapshot.source_url,
                "until": snapshot.fetched_at
                + (timedelta(days=30) if snapshot.complete else timedelta(minutes=5)),
                "complete": snapshot.complete,
                "counts": Jsonb(snapshot.layers.counts()),
            },
        )

    async def merge_hotel_tags(self, records: Sequence[HotelTags]) -> int:
        cursor = await self._connection.execute(
            HOTEL_TAGS_SQL,
            {"records": Jsonb([{"id": item.id, "tags": item.tags} for item in records])},
        )
        return cursor.rowcount

    async def refresh_heights(self, region: str, now: datetime) -> dict[str, int]:
        return await refresh_heights(self._connection, region, now)


def _bounds(bbox: GeographicBounds) -> dict[str, object]:
    return dict(zip(("west", "south", "east", "north"), bbox, strict=True))
