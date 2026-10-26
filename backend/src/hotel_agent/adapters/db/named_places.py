from psycopg import AsyncConnection

from hotel_agent.application.dto import NamedPlaceRecord

GEOGRAPHIC_NAME = """SELECT id,tags->>'name',ST_X(location),ST_Y(location)
FROM pois WHERE tags ? 'name' AND tags ?| ARRAY['natural','waterway','tourism','historic','place']
 AND ARRAY[translate(lower(tags->>'name'),'ё','е'),translate(lower(tags->>'name:ru'),'ё','е'),
 translate(lower(tags->>'alt_name'),'ё','е')] @> ARRAY[translate(lower(%(name)s),'ё','е')]
ORDER BY id LIMIT 2"""

NAME_LOOKUP = """SELECT id, tags->>'name', ST_X(location), ST_Y(location)
FROM pois
WHERE location && ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
  AND (translate(lower(tags->>'name'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
    OR translate(lower(tags->>'name:ru'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
    OR translate(lower(tags->>'alt_name'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е'))
ORDER BY id LIMIT 1"""

COORDINATE_LOOKUP = """SELECT id, tags->>'name', ST_X(location), ST_Y(location)
FROM pois
WHERE location && ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
  AND tags ? 'name'
  AND ST_DWithin(location::geography,
      ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, 120)
ORDER BY location <-> ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)
LIMIT 1"""

ALIAS_LOOKUP = """SELECT p.id, p.tags->>'name', ST_X(p.location), ST_Y(p.location)
FROM named_place_aliases a JOIN pois p
  ON ST_DWithin(p.location::geography, a.location::geography, 120)
WHERE translate(lower(a.alias), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
  AND p.location && ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
  AND p.tags ? 'name'
ORDER BY p.location <-> a.location LIMIT 1"""

FRAGMENT_LOOKUP = """SELECT id, tags->>'name', ST_X(location), ST_Y(location)
FROM pois
WHERE location && ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
  AND translate(lower(tags->>'name'), 'ё', 'е') LIKE '%%' || %(fragment)s || '%%'
  AND (tags->>'historic' IN ('castle', 'fort', 'monument', 'memorial')
    OR tags->>'tourism' IN ('attraction', 'museum'))
ORDER BY (tags->>'historic' = 'castle') DESC, length(tags->>'name'), id
LIMIT 1"""


class PostgresNamedPlaceRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def geographic_name(self, name: str) -> NamedPlaceRecord | None:
        rows = await (await self._connection.execute(GEOGRAPHIC_NAME, {"name": name})).fetchall()
        return _record(rows[0]) if len(rows) == 1 else None

    async def by_name(
        self, name: str, bbox: tuple[float, float, float, float]
    ) -> NamedPlaceRecord | None:
        params = _params(bbox) | {"name": name}
        row = await (await self._connection.execute(NAME_LOOKUP, params)).fetchone()
        if row is None:
            row = await (await self._connection.execute(ALIAS_LOOKUP, params)).fetchone()
        if row is None:
            fragment = _fragment(name)
            if len(fragment) >= 5:
                row = await (
                    await self._connection.execute(FRAGMENT_LOOKUP, params | {"fragment": fragment})
                ).fetchone()
        return _record(row)

    async def near_coordinate(
        self, location: tuple[float, float], bbox: tuple[float, float, float, float]
    ) -> NamedPlaceRecord | None:
        params = _params(bbox) | {"lon": location[0], "lat": location[1]}
        row = await (await self._connection.execute(COORDINATE_LOOKUP, params)).fetchone()
        return _record(row)


def _params(bbox: tuple[float, float, float, float]) -> dict[str, float]:
    return dict(zip(("west", "south", "east", "north"), bbox, strict=True))


def _record(row: tuple[object, ...] | None) -> NamedPlaceRecord | None:
    if row is None or row[1] is None:
        return None
    return NamedPlaceRecord(
        id=str(row[0]), name=str(row[1]), location=(float(str(row[2])), float(str(row[3])))
    )


def _fragment(name: str) -> str:
    value = name.strip().casefold().replace("ё", "е")
    if value.endswith("лем"):
        return value[:-2]
    return value[:-1] if value.endswith(("ь", "я", "а")) else value
