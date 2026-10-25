from collections.abc import Sequence
from datetime import date

from psycopg import AsyncConnection

from hotel_agent.application.dto import RegionRecord

LIST_LOADED = """SELECT r.id, r.name, ST_XMin(r.bbox), ST_YMin(r.bbox),
    ST_XMax(r.bbox), ST_YMax(r.bbox), count(h.id), r.built_at::date
FROM regions r LEFT JOIN hotels h ON h.region_id = r.id
GROUP BY r.id, r.name, r.bbox, r.built_at
ORDER BY r.id"""


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
