from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.application.dto import DemandRecord

MATCH_HITS = """SELECT r->'hotel'->>'id' AS hotel_id,
    m->>'characteristic_key' AS characteristic_key,
    m->>'match' AS quality
FROM chat_conversations c,
    LATERAL jsonb_array_elements(COALESCE(c.search_snapshot->'results', '[]'::jsonb)) r,
    LATERAL jsonb_array_elements(COALESCE(r->'matched', '[]'::jsonb)) m
WHERE c.updated_at >= %(since)s AND r->'hotel'->>'id' IS NOT NULL"""

HOTEL_DEMAND = (
    "WITH hits AS ("
    + MATCH_HITS
    + """ AND r->'hotel'->>'id' = %(hotel)s)
SELECT hotel_id, characteristic_key, count(*),
    count(*) FILTER (WHERE quality = 'unknown')
FROM hits
GROUP BY hotel_id, characteristic_key
ORDER BY 4 DESC, 3 DESC, characteristic_key"""
)

UNKNOWN_COUNTS = (
    "WITH hits AS ("
    + MATCH_HITS
    + """ AND c.region_id = %(region)s)
SELECT hotel_id, characteristic_key, count(*),
    count(*) FILTER (WHERE quality = 'unknown')
FROM hits
WHERE characteristic_key = ANY(%(keys)s)
GROUP BY hotel_id, characteristic_key
HAVING count(*) FILTER (WHERE quality = 'unknown') > 0
ORDER BY 4 DESC, hotel_id, characteristic_key
LIMIT %(limit)s"""
)

APPEARANCES = """SELECT count(*)
FROM chat_conversations c,
    LATERAL jsonb_array_elements(COALESCE(c.search_snapshot->'results', '[]'::jsonb)) r
WHERE c.updated_at >= %(since)s AND r->'hotel'->>'id' = %(hotel)s"""


class PostgresHotelierDemand:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def for_hotel(self, hotel_id: str, since: datetime) -> Sequence[DemandRecord]:
        result = await self._connection.execute(HOTEL_DEMAND, {"hotel": hotel_id, "since": since})
        return [_demand(row) for row in await result.fetchall()]

    async def appearances(self, hotel_id: str, since: datetime) -> int:
        result = await self._connection.execute(APPEARANCES, {"hotel": hotel_id, "since": since})
        row = await result.fetchone()
        return int(str(row[0])) if row else 0

    async def unknown_counts(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        since: datetime,
        limit: int = 2000,
    ) -> Sequence[DemandRecord]:
        if not characteristic_keys:
            return []
        result = await self._connection.execute(
            UNKNOWN_COUNTS,
            {
                "region": region,
                "keys": list(characteristic_keys),
                "since": since,
                "limit": limit,
            },
        )
        return [_demand(row) for row in await result.fetchall()]


def _demand(row: tuple[object, ...]) -> DemandRecord:
    return DemandRecord(
        hotel_id=str(row[0]),
        characteristic_key=str(row[1]),
        appearances=int(str(row[2])),
        blocked=int(str(row[3])),
    )
