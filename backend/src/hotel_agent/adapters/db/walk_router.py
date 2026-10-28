import asyncio
import json
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from time import monotonic

from psycopg import AsyncConnection

from hotel_agent.adapters.geo.place_walks import calculate_walks
from hotel_agent.application.dto import Feature
from hotel_agent.application.ports.walk import PlaceWalk

TARGETS = """SELECT ST_X(h.location), ST_Y(h.location), p.id, ST_X(p.location), ST_Y(p.location),
ST_Distance(h.location::geography,p.location::geography)
FROM hotels h CROSS JOIN pois p WHERE h.id=%(hotel)s AND p.id=ANY(%(targets)s::text[])"""

ONSITE = """SELECT h.id,p.id,ST_X(p.location),ST_Y(p.location)
FROM hotels h JOIN buildings b ON b.id=h.building_id
JOIN pois p ON ST_Covers(b.footprint,p.location)
WHERE h.id=ANY(%(hotels)s::text[]) AND p.id=ANY(%(targets)s::text[])
AND ST_Covers(b.footprint,h.location) ORDER BY h.id,p.id"""

EDGES = """SELECT w.id, ST_AsGeoJSON((ST_Dump(w.geometry)).geom)
FROM walk_edges w JOIN hotels h ON h.region_id=w.region_id
WHERE h.id=%(hotel)s AND w.geometry && ST_Expand(h.location,%(radius)s/75000.0)
AND ST_DWithin(w.geometry::geography,h.location::geography,%(radius)s)
ORDER BY w.id"""


class WalkRouteCache:
    def __init__(self) -> None:
        self._paths: OrderedDict[tuple[str, str, float], tuple[float, PlaceWalk]] = OrderedDict()

    def get(self, hotel: str, place: str, radius: float) -> PlaceWalk | None:
        key = (hotel, place, radius)
        cached = self._paths.get(key)
        if cached is None:
            return None
        if monotonic() - cached[0] > 600:
            del self._paths[key]
            return None
        self._paths.move_to_end(key)
        return cached[1]

    def put(self, path: PlaceWalk, radius: float) -> None:
        key = (path.hotel_id, path.place_id, radius)
        self._paths[key] = (monotonic(), path)
        self._paths.move_to_end(key)
        while len(self._paths) > 512:
            self._paths.popitem(last=False)


class PostgresWalkRouter:
    def __init__(
        self, connection: AsyncConnection[tuple[object, ...]], cache: WalkRouteCache
    ) -> None:
        self._connection = connection
        self._cache = cache

    async def in_buildings(
        self, origins: Sequence[str], targets: Sequence[str]
    ) -> Sequence[PlaceWalk]:
        if not origins or not targets:
            return ()
        rows = await (
            await self._connection.execute(
                ONSITE, {"hotels": list(origins), "targets": list(targets)}
            )
        ).fetchall()
        return [
            PlaceWalk(
                hotel_id=str(row[0]),
                place_id=str(row[1]),
                meters=0,
                minutes=None,
                mode="onsite",
                geometry={"type": "Point", "coordinates": [float(str(row[2])), float(str(row[3]))]},
            )
            for row in rows
        ]

    async def to_points(
        self, origin: str, targets: Mapping[str, tuple[float, float]], max_m: float
    ) -> Sequence[PlaceWalk]:
        if not targets:
            return ()
        row = await (
            await self._connection.execute(
                "SELECT ST_X(location),ST_Y(location) FROM hotels WHERE id=%s", (origin,)
            )
        ).fetchone()
        if row is None:
            return ()
        start = (float(str(row[0])), float(str(row[1])))
        radius = min(max(max_m, 500), 5000)
        rows = await (
            await self._connection.execute(EDGES, {"hotel": origin, "radius": radius * 1.4})
        ).fetchall()
        edges = [
            Feature(id=str(row[0]), geometry=json.loads(str(row[1])), properties={}) for row in rows
        ]
        return await asyncio.to_thread(calculate_walks, origin, start, targets, edges, radius)

    async def routes(
        self, origin: str, targets: Sequence[str], max_m: float
    ) -> Sequence[PlaceWalk]:
        radius = min(max(max_m, 500), 5000)
        ids = tuple(dict.fromkeys(targets))
        cached = {id: self._cache.get(origin, id, radius) for id in ids}
        missing = [id for id in ids if cached[id] is None]
        if not missing:
            return [path for id in ids if (path := cached[id]) is not None]
        rows = await (
            await self._connection.execute(TARGETS, {"hotel": origin, "targets": missing})
        ).fetchall()
        if not rows:
            return [path for path in cached.values() if path is not None]
        onsite = await self.in_buildings((origin,), missing)
        for path in onsite:
            self._cache.put(path, radius)
            cached[path.place_id] = path
        rows = [row for row in rows if cached[str(row[2])] is None]
        if not rows:
            return [path for path in cached.values() if path is not None]
        start = (float(str(rows[0][0])), float(str(rows[0][1])))
        destinations = {str(row[2]): (float(str(row[3])), float(str(row[4]))) for row in rows}
        search_radius = max(radius, min(max(float(str(row[5])) for row in rows), 5000))
        edge_rows = await (
            await self._connection.execute(EDGES, {"hotel": origin, "radius": search_radius * 1.4})
        ).fetchall()
        edges = [
            Feature(id=str(row[0]), geometry=json.loads(str(row[1])), properties={})
            for row in edge_rows
        ]
        paths = await asyncio.to_thread(
            calculate_walks, origin, start, destinations, edges, search_radius
        )
        for path in paths:
            self._cache.put(path, radius)
            cached[path.place_id] = path
        return [path for id in ids if (path := cached[id]) is not None]
