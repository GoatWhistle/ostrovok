from collections.abc import Mapping

from psycopg import AsyncConnection

from hotel_agent.domain.query import NearbyObjectRequest

NEARBY = """SELECT h.id,
    COALESCE(array_agg(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[])
FROM hotels h LEFT JOIN pois p
  ON p.region_id = h.region_id
 AND p.tags ? %(osm_key)s
 AND (%(osm_value)s = '*' OR p.tags->>%(osm_key)s = %(osm_value)s)
 AND (NOT %(open_24h)s OR lower(trim(p.tags->>'opening_hours')) = '24/7')
 AND ST_DWithin(p.location::geography, h.location::geography, %(radius_m)s)
WHERE h.region_id = %(region)s
GROUP BY h.id"""


class PostgresNearbyObjectRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list_matches(
        self, region: str, request: NearbyObjectRequest
    ) -> Mapping[str, tuple[str, ...]]:
        result = await self._connection.execute(
            NEARBY,
            {
                "region": region,
                "osm_key": request.osm_key,
                "osm_value": request.osm_value,
                "open_24h": request.open_24h,
                "radius_m": request.radius_m,
            },
        )
        rows = await result.fetchall()
        return {
            str(row[0]): tuple(str(item) for item in row[1])
            if isinstance(row[1], list | tuple)
            else ()
            for row in rows
        }
