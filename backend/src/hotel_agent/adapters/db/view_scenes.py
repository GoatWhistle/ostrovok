import json
from collections.abc import Mapping, Sequence

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.application.ports.view_scenes import PathBuildings, SceneBuilding

BUILDING_ROW_LIMIT = 20000

HOTEL_BUILDINGS = """SELECT h.id,b.id,ST_AsGeoJSON(b.footprint),b.tags,b.height_m,b.levels
FROM hotels h JOIN buildings b ON b.id=h.building_id WHERE h.id=ANY(%(ids)s::text[])"""

PATH_BUILDINGS = """WITH paths AS (
 SELECT key AS id,ST_Segmentize(ST_SetSRID(ST_GeomFromGeoJSON(value),4326)::geography,500)::geometry AS line
 FROM jsonb_each(%(paths)s::jsonb)
), segments AS (
 SELECT id,(ST_DumpSegments(line)).geom AS line FROM paths
)
SELECT DISTINCT ON (s.id,b.id) s.id,b.id,ST_AsGeoJSON(b.footprint),b.tags,b.height_m,b.levels
FROM segments s JOIN buildings b
 ON b.footprint && ST_Expand(s.line,0.001)
 AND ST_DWithin(b.footprint::geography,s.line::geography,30)
ORDER BY s.id,b.id LIMIT %(limit)s"""


PATH_COVERAGE = """WITH paths AS (
 SELECT key AS id,ST_Buffer(ST_Segmentize(
   ST_SetSRID(ST_GeomFromGeoJSON(value),4326)::geography,500),30)::geometry AS corridor
 FROM jsonb_each(%(paths)s::jsonb)
)
SELECT p.id,c.source_url FROM paths p JOIN LATERAL (
 SELECT source_url FROM geography_coverage
 WHERE complete AND valid_until>statement_timestamp() AND ST_Covers(bbox,p.corridor)
 ORDER BY fetched_at DESC LIMIT 1
) c ON true"""


class PostgresViewScenes:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def hotel_buildings(self, hotel_ids: Sequence[str]) -> Mapping[str, SceneBuilding]:
        rows = await (
            await self._connection.execute(HOTEL_BUILDINGS, {"ids": list(hotel_ids)})
        ).fetchall()
        return {str(row[0]): _building(row) for row in rows}

    async def path_buildings(
        self, paths: Mapping[str, tuple[tuple[float, float], ...]]
    ) -> PathBuildings:
        if not paths:
            return PathBuildings({}, False)
        if len(paths) > 256:
            raise ValueError("At most 256 window sightlines can be checked at once")
        geometries = {
            identifier: {"type": "LineString", "coordinates": points}
            for identifier, points in paths.items()
        }
        rows = await (
            await self._connection.execute(
                PATH_BUILDINGS, {"paths": Jsonb(geometries), "limit": BUILDING_ROW_LIMIT + 1}
            )
        ).fetchall()
        grouped: dict[str, list[SceneBuilding]] = {key: [] for key in paths}
        for row in rows[:BUILDING_ROW_LIMIT]:
            grouped[str(row[0])].append(_building(row))
        coverage = await (
            await self._connection.execute(PATH_COVERAGE, {"paths": Jsonb(geometries)})
        ).fetchall()
        truncated = len(rows) > BUILDING_ROW_LIMIT
        complete_paths = (
            frozenset(str(row[0]) for row in rows[:-1]) - {str(rows[-1][0])}
            if truncated
            else frozenset(paths)
        )
        return PathBuildings(
            {key: tuple(values) for key, values in grouped.items()},
            truncated,
            {str(row[0]): str(row[1]) for row in coverage},
            complete_paths,
        )


def _building(row: tuple[object, ...]) -> SceneBuilding:
    return SceneBuilding(
        id=str(row[1]),
        geometry=json.loads(str(row[2])),
        tags={str(k): str(v) for k, v in row[3].items()} if isinstance(row[3], dict) else {},
        height_m=float(str(row[4])) if row[4] is not None else None,
        levels=int(str(row[5])) if row[5] is not None else None,
    )
