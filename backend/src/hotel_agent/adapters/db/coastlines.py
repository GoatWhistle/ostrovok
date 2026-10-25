from collections.abc import Mapping, Sequence

from psycopg import AsyncConnection

NEAREST = """SELECT h.id,
    ST_X(ST_ClosestPoint(c.geometry, h.location)),
    ST_Y(ST_ClosestPoint(c.geometry, h.location))
FROM hotels h
JOIN LATERAL (
    SELECT geometry FROM coastline c
    WHERE c.region_id = h.region_id
      AND c.geometry && ST_Expand(h.location, 0.1)
    ORDER BY c.geometry <-> h.location
    LIMIT 1
) c ON true
WHERE h.id = ANY(%(hotel_ids)s::text[])"""


class PostgresCoastlineRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def nearest_points(self, hotel_ids: Sequence[str]) -> Mapping[str, tuple[float, float]]:
        if not hotel_ids:
            return {}
        rows = await (
            await self._connection.execute(NEAREST, {"hotel_ids": list(hotel_ids)})
        ).fetchall()
        return {str(row[0]): (float(str(row[1])), float(str(row[2]))) for row in rows}
