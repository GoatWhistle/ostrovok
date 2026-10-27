import json
from collections.abc import Sequence

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from hotel_agent.application.ports.facades import BuildingFootprint, FacadeSegment

FOOTPRINTS = """SELECT h.id, b.id, ST_AsGeoJSON(b.footprint)
FROM hotels h JOIN buildings b ON b.id = h.building_id
WHERE h.region_id = %(region)s ORDER BY h.id"""

INSERT_FACADE = """INSERT INTO facades
    (id, hotel_id, building_id, azimuth_deg, label, geometry)
VALUES (%(id)s, %(hotel_id)s, %(building_id)s, %(azimuth)s, %(label)s,
    ST_GeomFromGeoJSON(%(geometry)s))
ON CONFLICT (id) DO UPDATE SET azimuth_deg = EXCLUDED.azimuth_deg,
    label = EXCLUDED.label, geometry = EXCLUDED.geometry"""

FACADE_FEATURES = """INSERT INTO geo_features
    (id, kind, characteristic_key, geometry, name, label, style_hint)
SELECT 'g_' || f.id, 'facade', 'noise_level', f.geometry, NULL, f.label, 'facade'
FROM facades f JOIN hotels h ON h.id = f.hotel_id WHERE h.region_id = %(region)s
ON CONFLICT (id) DO UPDATE SET geometry = EXCLUDED.geometry, label = EXCLUDED.label"""

NOISE_FACTS = """WITH levels AS (
    SELECT f.id facade_id,
        LEAST(10.0, ROUND((
            COALESCE((SELECT MAX(GREATEST(0, 8 - ST_Distance(
                n.geometry::geography, f.geometry::geography) / 30))
                FROM noise_sources n
                WHERE n.region_id = %(region)s
                  AND ST_DWithin(n.geometry::geography, f.geometry::geography, 240)), 0)
            + COALESCE((SELECT MAX(GREATEST(0, 4 - ST_Distance(
                p.location::geography, f.geometry::geography) / 50))
                FROM pois p
                WHERE p.region_id = %(region)s
                  AND p.tags->>'amenity' IN ('bar', 'pub', 'nightclub')
                  AND ST_DWithin(p.location::geography, f.geometry::geography, 200)), 0)
        )::numeric, 1)) score
    FROM facades f JOIN hotels h ON h.id = f.hotel_id
    WHERE h.region_id = %(region)s
)
INSERT INTO facts (id, subject_type, subject_id, characteristic_key, value, unit,
    source_type, method, confidence, computed_at, valid_until, status, geo_refs, explanation)
SELECT 'f_noise_' || facade_id, 'facade', facade_id, 'noise_level',
    to_jsonb(score), 'score', 'computed', 'noise_level@1', 0.6,
    now(), now() + interval '180 days', 'active', ARRAY['g_' || facade_id],
    'Оценка 0–10 по расстоянию до дорог, железной дороги и баров OSM; не замер звука'
FROM levels
WHERE NOT EXISTS (SELECT 1 FROM facts kept WHERE kept.subject_type = 'facade'
    AND kept.subject_id = facade_id AND kept.characteristic_key = 'noise_level'
    AND kept.id <> 'f_noise_' || facade_id AND kept.status <> 'superseded')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value,
    computed_at = EXCLUDED.computed_at, valid_until = EXCLUDED.valid_until
WHERE facts.status = 'active'"""


class PostgresFacadeStore:
    def __init__(self, pool: AsyncConnectionPool[AsyncConnection[tuple[object, ...]]]) -> None:
        self._pool = pool

    async def footprints(self, region: str) -> Sequence[BuildingFootprint]:
        async with self._pool.connection() as db:
            result = await db.execute(FOOTPRINTS, {"region": region})
            rows = await result.fetchall()
        return [
            BuildingFootprint(
                hotel_id=str(row[0]),
                building_id=str(row[1]),
                geometry=json.loads(str(row[2])),
            )
            for row in rows
        ]

    async def save(self, region: str, facades: Sequence[FacadeSegment]) -> int:
        rows = [
            {
                "id": item.id,
                "hotel_id": item.hotel_id,
                "building_id": item.building_id,
                "azimuth": item.azimuth_deg,
                "label": item.label,
                "geometry": json.dumps(item.geometry),
            }
            for item in facades
        ]
        async with self._pool.connection() as db, db.cursor() as cursor:
            await cursor.executemany(INSERT_FACADE, rows)
            await cursor.execute(FACADE_FEATURES, {"region": region})
        return len(facades)

    async def compute_noise(self, region: str) -> int:
        async with self._pool.connection() as db:
            result = await db.execute(NOISE_FACTS, {"region": region})
            return result.rowcount
