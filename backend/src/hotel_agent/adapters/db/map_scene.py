import json

from psycopg import AsyncConnection

from hotel_agent.application.ports.map_scene import SceneBuildingRecord, SceneCandidates

CANDIDATES = """WITH area AS (
    SELECT ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326) AS geom
), hits AS (
    SELECT b.id, b.hotel_id, b.class, b.class_source, b.height_m, b.levels, b.height_source,
        b.tags->>'min_height' AS min_height, b.footprint,
        ST_Distance(b.footprint, ST_Centroid(area.geom)) AS distance
    FROM buildings b, area
    WHERE b.region_id = %(region)s AND b.footprint && area.geom
      AND ST_Intersects(b.footprint, area.geom)
)
SELECT id, hotel_id, class, class_source, height_m, levels, height_source, min_height,
    ST_AsGeoJSON(footprint, 7), ST_NPoints(footprint), count(*) OVER ()
FROM hits
ORDER BY distance, id
LIMIT %(limit)s"""


class PostgresMapScene:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def candidates(
        self, region: str, bbox: tuple[float, float, float, float], limit: int
    ) -> SceneCandidates:
        west, south, east, north = bbox
        cursor = await self._connection.execute(
            CANDIDATES,
            {
                "region": region,
                "west": west,
                "south": south,
                "east": east,
                "north": north,
                "limit": limit,
            },
        )
        rows = await cursor.fetchall()
        eligible = int(str(rows[0][10])) if rows else 0
        return SceneCandidates(eligible=eligible, buildings=tuple(_building(row) for row in rows))


def _number(value: object) -> float | None:
    try:
        return float(str(value)) if value is not None else None
    except ValueError:
        return None


def _building(row: tuple[object, ...]) -> SceneBuildingRecord:
    return SceneBuildingRecord(
        id=str(row[0]),
        hotel_id=str(row[1]) if row[1] is not None else None,
        building_class=str(row[2]),
        class_source=str(row[3]),
        height_m=_number(row[4]),
        levels=int(str(row[5])) if row[5] is not None else None,
        height_source=str(row[6]),
        min_height_m=max(0.0, _number(row[7]) or 0.0),
        geometry=json.loads(str(row[8])),
        points=int(str(row[9])),
    )
