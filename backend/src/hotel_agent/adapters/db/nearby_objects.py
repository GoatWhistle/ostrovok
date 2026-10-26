from collections.abc import Mapping

from psycopg import AsyncConnection

from hotel_agent.domain.query import NearbyObjectRequest

NAME_TAGS = (
    "name",
    "name:ru",
    "name:en",
    "int_name",
    "alt_name",
    "short_name",
    "official_name",
    "brand",
    "brand:ru",
    "operator",
    "cuisine",
)

NEARBY = """WITH objects AS MATERIALIZED (
    SELECT p.id,p.location FROM pois p
    WHERE p.region_id = %(region)s AND p.tags ? %(osm_key)s
      AND (%(osm_value)s = '*' OR %(name)s::text[] IS NOT NULL
           OR p.tags @> jsonb_build_object(%(osm_key)s::text,%(osm_value)s::text))
      AND (NOT %(open_24h)s OR lower(trim(p.tags->>'opening_hours')) = '24/7')
      AND (%(name)s::text[] IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_each_text(p.tags) AS tag(key, value)
            WHERE tag.key = ANY(%(name_tags)s::text[])
              AND translate(lower(tag.value), 'ё', 'е') LIKE ALL(%(name)s::text[])))
      AND (%(bbox)s::double precision[] IS NULL OR ST_DWithin(p.location::geography,
          ST_MakeEnvelope((%(bbox)s::double precision[])[1], (%(bbox)s::double precision[])[2],
                          (%(bbox)s::double precision[])[3], (%(bbox)s::double precision[])[4],
                          4326)::geography, %(radius_m)s))
)
SELECT h.id, COALESCE(array_agg(p.id ORDER BY p.location <-> h.location, p.id)
    FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[])
FROM hotels h LEFT JOIN objects p
 ON ST_DWithin(p.location::geography, h.location::geography, %(radius_m)s)
WHERE h.region_id = %(region)s
  AND (%(bbox)s::double precision[] IS NULL OR ST_Intersects(h.location,
      ST_MakeEnvelope((%(bbox)s::double precision[])[1], (%(bbox)s::double precision[])[2],
                      (%(bbox)s::double precision[])[3], (%(bbox)s::double precision[])[4], 4326)))
GROUP BY h.id"""


def name_patterns(name: str) -> list[str] | None:
    words = [
        word for word in name.casefold().replace("ё", "е").split() if len(word.strip(".,:;")) >= 3
    ]
    if not words:
        return None
    return [f"%{word[:-1] if len(word) >= 5 else word}%" for word in words]


class PostgresNearbyObjectRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list_matches(
        self,
        region: str,
        request: NearbyObjectRequest,
        bbox: tuple[float, float, float, float] | None = None,
    ) -> Mapping[str, tuple[str, ...]]:
        result = await self._connection.execute(
            NEARBY,
            {
                "region": region,
                "osm_key": request.osm_key,
                "osm_value": request.osm_value,
                "open_24h": request.open_24h,
                "radius_m": request.radius_m,
                "bbox": list(bbox) if bbox else None,
                "name": name_patterns(request.name),
                "name_tags": list(NAME_TAGS),
            },
        )
        rows = await result.fetchall()
        return {
            str(row[0]): tuple(str(item) for item in row[1])
            if isinstance(row[1], list | tuple)
            else ()
            for row in rows
        }
