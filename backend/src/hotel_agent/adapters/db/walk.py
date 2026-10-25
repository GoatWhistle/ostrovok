import json
from collections.abc import Sequence

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from hotel_agent.application.ports.walk import WalkPath

ROUTE_SQL = """INSERT INTO geo_features
    (id, kind, characteristic_key, geometry, name, label, style_hint)
VALUES (%(id)s, 'route', 'distance_to_sea', ST_GeomFromGeoJSON(%(geometry)s),
    'Пешком до моря', 'Пеший маршрут', 'line')
ON CONFLICT (id) DO UPDATE SET geometry = EXCLUDED.geometry"""

FACT_SQL = """INSERT INTO facts
    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
     source_type, method, confidence, computed_at, valid_until, status, geo_refs, explanation)
VALUES (%(id)s, 'hotel', %(hotel_id)s, 'distance_to_sea', %(minutes)s::jsonb,
    'min', %(qualifiers)s::jsonb, 'computed', 'distance_to_sea@1', 0.8,
    now(), now() + interval '365 days', 'active', %(geo_refs)s,
    'Кратчайший маршрут по пешеходному графу OSM до точки доступа к берегу')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, qualifiers = EXCLUDED.qualifiers,
    geo_refs = EXCLUDED.geo_refs, computed_at = EXCLUDED.computed_at,
    valid_until = EXCLUDED.valid_until"""


class PostgresWalkStore:
    def __init__(self, pool: AsyncConnectionPool[AsyncConnection[tuple[object, ...]]]) -> None:
        self._pool = pool

    async def save(self, region: str, paths: Sequence[WalkPath]) -> int:
        if not paths:
            return 0
        route_rows = [
            {"id": f"g_route_{item.hotel_id}", "geometry": json.dumps(item.geometry)}
            for item in paths
        ]
        fact_rows = [
            {
                "id": f"f_sea_{item.hotel_id}",
                "hotel_id": item.hotel_id,
                "minutes": json.dumps(item.minutes),
                "qualifiers": json.dumps(
                    {"meters": item.meters, "elevation_delta_m": item.elevation_delta_m}
                ),
                "geo_refs": [f"g_route_{item.hotel_id}"],
            }
            for item in paths
        ]
        async with self._pool.connection() as db, db.cursor() as cursor:
            await cursor.executemany(ROUTE_SQL, route_rows)
            await cursor.executemany(FACT_SQL, fact_rows)
        return len(paths)
