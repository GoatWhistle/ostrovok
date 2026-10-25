import json
from collections.abc import Sequence

from psycopg import AsyncConnection

from hotel_agent.application.dto import GeoFeatureRecord

GET_BATCH = """SELECT g.id, g.kind, g.characteristic_key, ST_AsGeoJSON(g.geometry),
    g.name, g.label, g.osm_ref, g.style_hint
FROM unnest(%(ids)s::text[]) WITH ORDINALITY AS wanted(id, position)
JOIN geo_features g ON g.id = wanted.id ORDER BY wanted.position"""


class PostgresGeoFeatureRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def get_batch(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]:
        result = await self._connection.execute(GET_BATCH, {"ids": list(ids)})
        rows = await result.fetchall()
        return [
            GeoFeatureRecord(
                id=str(row[0]),
                kind=str(row[1]),
                characteristic_key=str(row[2]),
                geometry=json.loads(str(row[3])),
                name=str(row[4]) if row[4] is not None else None,
                label=str(row[5]) if row[5] is not None else None,
                osm_ref=str(row[6]) if row[6] is not None else None,
                style_hint=str(row[7]) if row[7] is not None else None,
            )
            for row in rows
        ]
