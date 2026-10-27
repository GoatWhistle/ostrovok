from psycopg import AsyncConnection

from hotel_agent.application.dto import LocalAreaRecord

SETTLEMENT_ORDER = ["city", "town", "borough", "suburb", "village", "hamlet"]

NAMED_REGION = """SELECT id FROM regions
WHERE id <> 'russia' AND (translate(lower(name), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
  OR id = lower(%(name)s))
ORDER BY id LIMIT 1"""

LOCAL_ANCHOR = """WITH wanted AS (SELECT translate(lower(%(name)s), 'ё', 'е') AS name),
local AS (SELECT id, bbox FROM regions WHERE id <> 'russia'),
named AS (
 SELECT l.id AS region_id, p.location, p.tags->>'place' AS kind
 FROM local l JOIN pois p ON p.location && l.bbox AND p.region_id = l.id CROSS JOIN wanted w
 WHERE (p.tags ? 'place' OR p.tags ? 'railway' OR p.tags ? 'public_transport')
  AND w.name IN (translate(lower(p.tags->>'name'), 'ё', 'е'),
   translate(lower(p.tags->>'name:ru'), 'ё', 'е'), lower(p.tags->>'name:en'),
   translate(lower(p.tags->>'alt_name'), 'ё', 'е'))
 UNION ALL
 SELECT l.id, h.location, NULL
 FROM local l JOIN hotels h ON h.region_id = l.id CROSS JOIN wanted w
 WHERE w.name IN (translate(lower(h.tags->>'addr:city'), 'ё', 'е'),
  translate(lower(h.tags->>'addr:suburb'), 'ё', 'е'))
), ranked AS (
 SELECT *, bool_or(kind IS NOT NULL) OVER (PARTITION BY region_id) AS settled FROM named
)
SELECT region_id,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_X(location)),
 percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Y(location)),
 (array_agg(kind ORDER BY array_position(%(kinds)s::text[], kind)))[1]
FROM ranked WHERE settled = (kind IS NOT NULL)
GROUP BY region_id ORDER BY count(*) DESC, region_id LIMIT 1"""


async def local_area(
    connection: AsyncConnection[tuple[object, ...]], name: str
) -> LocalAreaRecord | None:
    row = await (await connection.execute(NAMED_REGION, {"name": name})).fetchone()
    if row is not None:
        return LocalAreaRecord(region_id=str(row[0]))
    params = {"name": name, "kinds": SETTLEMENT_ORDER}
    row = await (await connection.execute(LOCAL_ANCHOR, params)).fetchone()
    if row is None or row[1] is None or row[2] is None:
        return None
    return LocalAreaRecord(
        region_id=str(row[0]),
        center=(float(str(row[1])), float(str(row[2]))),
        kind=str(row[3]) if row[3] is not None else None,
    )
