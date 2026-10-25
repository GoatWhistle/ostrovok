from collections.abc import Sequence
from datetime import date
from math import cos, radians

from psycopg import AsyncConnection

from hotel_agent.application.dto import RegionRecord

LIST_LOADED = """SELECT r.id, r.name, ST_XMin(r.bbox), ST_YMin(r.bbox),
    ST_XMax(r.bbox), ST_YMax(r.bbox), count(h.id), r.built_at::date
FROM regions r LEFT JOIN hotels h ON h.region_id = r.id
GROUP BY r.id, r.name, r.bbox, r.built_at
ORDER BY r.id"""

CITY_EXTENT = """SELECT
    percentile_cont(0.05) WITHIN GROUP (ORDER BY ST_X(location)),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY ST_X(location)),
    percentile_cont(0.05) WITHIN GROUP (ORDER BY ST_Y(location)),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY ST_Y(location))
FROM hotels WHERE region_id = 'russia'
  AND translate(lower(tags->>'addr:city'), 'ё', 'е') =
      translate(lower(%(city)s), 'ё', 'е')"""

CITY_CENTER = """SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_X(location)),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Y(location))
FROM hotels WHERE region_id = 'russia'
  AND translate(lower(tags->>'addr:city'), 'ё', 'е') =
      translate(lower(%(city)s), 'ё', 'е')"""


class PostgresRegionRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list_loaded(self) -> Sequence[RegionRecord]:
        result = await self._connection.execute(LIST_LOADED)
        rows = await result.fetchall()
        return [
            RegionRecord(
                id=str(row[0]),
                name=str(row[1]),
                bbox=(
                    float(str(row[2])),
                    float(str(row[3])),
                    float(str(row[4])),
                    float(str(row[5])),
                ),
                hotels_count=int(str(row[6])),
                data_as_of=date.fromisoformat(str(row[7])),
            )
            for row in rows
        ]

    async def city_bbox(self, city: str) -> tuple[float, float, float, float] | None:
        result = await self._connection.execute(CITY_EXTENT, {"city": city})
        row = await result.fetchone()
        if row is None or row[0] is None:
            return None
        west, east, south, north = (float(str(value)) for value in row)
        latitude = (south + north) / 2
        latitude_margin = 8_000 / 111_200
        longitude_margin = latitude_margin / max(cos(radians(latitude)), 0.1)
        return (
            west - longitude_margin,
            south - latitude_margin,
            east + longitude_margin,
            north + latitude_margin,
        )

    async def city_center(self, city: str) -> tuple[float, float] | None:
        row = await (await self._connection.execute(CITY_CENTER, {"city": city})).fetchone()
        if row is None or row[0] is None or row[1] is None:
            return None
        return float(str(row[0])), float(str(row[1]))
