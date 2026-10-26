from datetime import datetime

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.adapters.geo.building_dimensions import length_values

BUILDINGS_SQL = """SELECT h.id,b.id,b.tags FROM hotels h
JOIN buildings b ON b.id=h.building_id WHERE h.region_id=%(region)s"""

LEGACY_SQL = """SELECT DISTINCT b.id,b.tags FROM facts f
JOIN hotels h ON h.id=f.subject_id JOIN buildings b ON b.id=f.source_id
WHERE h.region_id=%(region)s AND f.characteristic_key='building_height'
 AND f.method='building_height@1' AND f.confidence<0.9 AND f.status='active'
 AND f.source_type='computed'"""

HEIGHT_SQL = """INSERT INTO facts(id,subject_type,subject_id,characteristic_key,value,unit,
 qualifiers,source_type,source_id,method,confidence,computed_at,valid_until,status,explanation)
VALUES (%(id)s,'hotel',%(hotel)s,'building_height',%(height)s,'m',%(qualifiers)s,
 'computed',%(building)s,'osm_building_height@1',0.9,%(now)s,%(now)s+interval '730 days',
 'active','Высота здания из тега OSM; не высота и не этаж конкретного номера')
ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,qualifiers=EXCLUDED.qualifiers,
 source_id=EXCLUDED.source_id,method=EXCLUDED.method,confidence=EXCLUDED.confidence,
 computed_at=EXCLUDED.computed_at,valid_until=EXCLUDED.valid_until,status=EXCLUDED.status,
 explanation=EXCLUDED.explanation
WHERE facts.source_type='computed' AND facts.status<>'confirmed_by_hotelier'"""

RETIRE_SQL = """UPDATE facts f SET status='stale',valid_until=%(now)s
FROM hotels h WHERE h.id=f.subject_id AND h.region_id=%(region)s
 AND f.characteristic_key='building_height' AND f.method='building_height@1'
 AND f.confidence<0.9 AND f.status='active' AND f.source_type='computed'"""

CLEAR_SQL = "UPDATE buildings SET height_m=NULL WHERE id=ANY(%(ids)s::text[])"


async def refresh_heights(
    connection: AsyncConnection[tuple[object, ...]], region: str, now: datetime
) -> dict[str, int]:
    cursor = await connection.execute(LEGACY_SQL, {"region": region})
    guessed = []
    for identifier, raw_tags in await cursor.fetchall():
        tags = raw_tags if isinstance(raw_tags, dict) else {}
        heights = length_values(str(tags.get("height", "")))
        if not heights or len(set(heights)) != 1:
            guessed.append(str(identifier))
    cursor = await connection.execute(CLEAR_SQL, {"ids": guessed})
    cleared = cursor.rowcount
    cursor = await connection.execute(RETIRE_SQL, {"region": region, "now": now})
    retired = cursor.rowcount
    cursor = await connection.execute(BUILDINGS_SQL, {"region": region})
    rows = []
    for hotel, building, raw_tags in await cursor.fetchall():
        tags = raw_tags if isinstance(raw_tags, dict) else {}
        raw_height = str(tags.get("height", ""))
        heights = length_values(raw_height)
        if not heights or len(set(heights)) != 1 or heights[0] <= 0:
            continue
        rows.append(
            {
                "id": f"f_height_{hotel}",
                "hotel": str(hotel),
                "building": str(building),
                "height": Jsonb(heights[0]),
                "qualifiers": Jsonb({"basis": "osm:height", "raw_height": raw_height}),
                "now": now,
            }
        )
    async with connection.cursor() as cursor:
        await cursor.executemany(HEIGHT_SQL, rows)
        saved = cursor.rowcount
    return {
        "explicit_height_facts": saved,
        "guesses_retired": retired,
        "guessed_scalars_cleared": cleared,
    }
