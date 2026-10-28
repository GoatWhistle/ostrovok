from collections.abc import Mapping

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

HEIGHTS = """WITH heights AS (
    SELECT h.id hotel_id, b.id building_id,
        CASE
            WHEN b.tags->>'height' ~ '^[0-9]+(\\.[0-9]+)?$'
                THEN (b.tags->>'height')::double precision
            WHEN b.tags->>'building:levels' ~ '^[0-9]+$'
                THEN (b.tags->>'building:levels')::integer * 3.2
            WHEN b.tags->>'building' = 'hotel' THEN 12.8
            ELSE 9.6 END height_m,
        CASE
            WHEN b.tags->>'height' ~ '^[0-9]+(\\.[0-9]+)?$' THEN 0.9
            WHEN b.tags->>'building:levels' ~ '^[0-9]+$' THEN 0.7
            ELSE 0.3 END confidence
    FROM hotels h JOIN buildings b ON b.id = h.building_id
    WHERE h.region_id = %(region)s
), updated AS (
    UPDATE buildings b SET height_m = x.height_m,
        levels = CASE WHEN b.tags->>'building:levels' ~ '^[0-9]+$'
            THEN (b.tags->>'building:levels')::integer ELSE NULL END
    FROM heights x WHERE b.id = x.building_id RETURNING b.id
)
INSERT INTO facts (id, subject_type, subject_id, characteristic_key, value, unit,
    source_type, source_id, method, confidence, computed_at, valid_until, status, explanation)
SELECT 'f_height_' || x.hotel_id, 'hotel', x.hotel_id, 'building_height',
    to_jsonb(x.height_m), 'm', 'computed', x.building_id, 'building_height@1',
    x.confidence, now(), now() + interval '730 days', 'active',
    'Высота по тегу OSM или оценке этажности здания'
FROM heights x
WHERE NOT EXISTS (SELECT 1 FROM facts kept WHERE kept.subject_type = 'hotel'
    AND kept.subject_id = x.hotel_id AND kept.characteristic_key = 'building_height'
    AND kept.id <> 'f_height_' || x.hotel_id AND kept.status <> 'superseded')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, confidence = EXCLUDED.confidence,
    computed_at = EXCLUDED.computed_at, valid_until = EXCLUDED.valid_until,
    explanation = EXCLUDED.explanation
WHERE facts.status = 'active'"""

POI_GEO_FEATURES = """INSERT INTO geo_features
    (id, kind, characteristic_key, geometry, name, osm_ref, style_hint)
SELECT 'g_poi_' || id, 'poi', 'nearby_objects', location, tags->>'name', id, 'points'
FROM pois WHERE region_id = %(region)s
ON CONFLICT (id) DO UPDATE SET geometry = EXCLUDED.geometry, name = EXCLUDED.name,
    characteristic_key = EXCLUDED.characteristic_key"""

REMOVE_LEGACY_BARS = """DELETE FROM facts
WHERE characteristic_key = 'bars_nearby'
  AND subject_id IN (SELECT id FROM hotels WHERE region_id = %(region)s)"""

DOUBLE_ROOMS = """INSERT INTO facts
    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
     source_type, method, confidence, computed_at, valid_until, status, explanation)
SELECT 'f_double_room_' || r.hotel_id, 'hotel', r.hotel_id, 'double_room',
    to_jsonb(bool_or(r.capacity = 2)), NULL, '{"source":"room_inventory"}'::jsonb,
    'computed', 'double_room@1', 0.85, now(), now() + interval '90 days', 'active',
    'Вместимость проверена по инвентаризации номеров отеля'
FROM rooms r JOIN hotels h ON h.id = r.hotel_id
WHERE h.region_id = %(region)s AND NOT r.synthetic
  AND NOT EXISTS (SELECT 1 FROM facts kept WHERE kept.subject_type = 'hotel'
    AND kept.subject_id = r.hotel_id AND kept.characteristic_key = 'double_room'
    AND kept.id <> 'f_double_room_' || r.hotel_id AND kept.status <> 'superseded')
GROUP BY r.hotel_id
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at,
    valid_until = EXCLUDED.valid_until
WHERE facts.status = 'active'"""


PETS_POLICY = """INSERT INTO facts
    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
     source_type, method, confidence, computed_at, valid_until, status, explanation)
SELECT 'f_pets_policy_' || c.hotel_id, 'hotel', c.hotel_id, 'pets_policy',
    jsonb_build_object('allowed', (policy->>'allowed')::boolean, 'terms', policy->>'terms'),
    NULL, jsonb_build_object('source', 'supplier_content', 'supplier', c.supplier),
    'computed', 'pets_policy@1', 0.8, now(), now() + interval '180 days', 'active',
    'Правила размещения с животными по данным поставщика'
FROM hotel_supplier_content c
JOIN hotels h ON h.id = c.hotel_id
CROSS JOIN LATERAL (
    SELECT jsonb_path_query_first(c.details, '$.**.pets') AS policy
) found
WHERE h.region_id = %(region)s AND found.policy ? 'allowed'
  AND jsonb_typeof(found.policy->'allowed') = 'boolean'
  AND NOT EXISTS (SELECT 1 FROM facts kept WHERE kept.subject_type = 'hotel'
    AND kept.subject_id = c.hotel_id AND kept.characteristic_key = 'pets_policy'
    AND kept.id <> 'f_pets_policy_' || c.hotel_id AND kept.status <> 'superseded')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at,
    valid_until = EXCLUDED.valid_until
WHERE facts.status = 'active'"""


class PostgresPrecompute:
    def __init__(self, pool: AsyncConnectionPool[AsyncConnection[tuple[object, ...]]]) -> None:
        self._pool = pool

    async def run(self, region: str) -> Mapping[str, int]:
        async with self._pool.connection() as db:
            await db.execute(POI_GEO_FEATURES, {"region": region})
            await db.execute(REMOVE_LEGACY_BARS, {"region": region})
            height_result = await db.execute(HEIGHTS, {"region": region})
            rooms_result = await db.execute(DOUBLE_ROOMS, {"region": region})
            pets_result = await db.execute(PETS_POLICY, {"region": region})
            return {
                "building_height": height_result.rowcount,
                "double_room": rooms_result.rowcount,
                "pets_policy": pets_result.rowcount,
            }
