from collections.abc import Sequence

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
  AND (%(target_key)s::text IS NULL OR (tags ? %(target_key)s
    AND (cardinality(%(target_values)s::text[])=0 OR tags->>%(target_key)s = ANY(%(target_values)s::text[]))))
  AND (translate(lower(tags->>'name'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
    OR translate(lower(tags->>'name:ru'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е')
    OR translate(lower(tags->>'alt_name'), 'ё', 'е') = translate(lower(%(name)s), 'ё', 'е'))
ORDER BY CASE
 WHEN tags->>'public_transport' IN ('platform','stop_position') THEN 2
 WHEN tags ? 'historic' OR tags ? 'natural' OR tags->>'tourism' IN ('attraction','museum')
   OR tags->>'amenity' IN ('place_of_worship','theatre') THEN 0
 ELSE 1 END, id LIMIT 1"""

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
  AND (%(target_key)s::text IS NULL OR (p.tags ? %(target_key)s
    AND (cardinality(%(target_values)s::text[])=0 OR p.tags->>%(target_key)s = ANY(%(target_values)s::text[]))))
ORDER BY p.location <-> a.location LIMIT 1"""

FRAGMENT_LOOKUP = """SELECT id, tags->>'name', ST_X(location), ST_Y(location)
FROM pois
WHERE location && ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
  AND translate(lower(tags->>'name'), 'ё', 'е') LIKE '%%' || %(fragment)s || '%%'
  AND (%(target_key)s::text IS NULL OR (tags ? %(target_key)s
    AND (cardinality(%(target_values)s::text[])=0 OR tags->>%(target_key)s = ANY(%(target_values)s::text[]))))
  AND (%(target_key)s::text IS NOT NULL OR tags->>'historic' IN ('castle', 'fort', 'monument', 'memorial')
    OR tags->>'tourism' IN ('attraction', 'museum'))
ORDER BY (tags->>'historic' = 'castle') DESC, length(tags->>'name'), id
LIMIT 1"""


TOKEN_LOOKUP = """WITH candidates AS (
 SELECT id,tags,location,to_tsvector('russian',tags->>'name') AS document
 FROM pois WHERE location && ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326)
  AND %(target_key)s::text IS NOT NULL AND tags ? %(target_key)s
  AND (cardinality(%(target_values)s::text[])=0 OR tags->>%(target_key)s = ANY(%(target_values)s::text[]))
), tokens AS (
 SELECT DISTINCT token,plainto_tsquery('russian',token) AS query
 FROM regexp_split_to_table(%(name)s,'[^[:alpha:]]+') AS token WHERE length(token)>=5
), hits AS (
 SELECT c.id,t.token,count(*) OVER (PARTITION BY t.token) AS frequency
 FROM candidates c JOIN tokens t ON c.document @@ t.query
), ranked AS (
 SELECT id,sum(1.0/frequency)::double precision AS score FROM hits GROUP BY id
)
SELECT c.id,c.tags->>'name',ST_X(c.location),ST_Y(c.location),r.score,
 COALESCE(c.tags->>'tourism' IN ('attraction','museum'),false) AS canonical
FROM ranked r JOIN candidates c ON c.id=r.id
ORDER BY r.score DESC,canonical DESC,c.id LIMIT 2"""


CANDIDATE_LOOKUP = """WITH candidates AS (
SELECT id,tags,location,(SELECT count(*) FROM
 regexp_split_to_table(%(name)s,'[^[:alpha:]]+') token
 WHERE length(token)>=5 AND to_tsvector('russian',concat_ws(' ',
 tags->>'name',tags->>'name:ru',tags->>'alt_name')) @@ plainto_tsquery('russian',token)
) AS matched_tokens
FROM pois WHERE location && ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326)
 AND tags ? 'name'
 AND (%(target_key)s::text IS NULL OR (tags ? %(target_key)s AND
   (cardinality(%(target_values)s::text[])=0 OR tags->>%(target_key)s=ANY(%(target_values)s::text[]))))
 AND (%(target_key)s::text IS NOT NULL OR tags ?| ARRAY['historic','natural','waterway']
   OR tags->>'man_made' IN ('tower','lighthouse')
   OR tags->>'tourism' IN ('attraction','museum') OR tags->>'amenity' IN ('place_of_worship','theatre'))
)
SELECT id,tags->>'name',ST_X(location),ST_Y(location),tags FROM candidates
WHERE matched_tokens>0 OR EXISTS (
 SELECT 1 FROM unnest(ARRAY[tags->>'name',tags->>'name:ru',tags->>'alt_name']) value
 WHERE strpos(translate(lower(value),'ё','е'),%(fragment)s)>0)
ORDER BY matched_tokens DESC,CASE WHEN id ~ '^[rw][0-9]+$' THEN 0 ELSE 1 END,
 length(tags->>'name'),id LIMIT 16"""


class PostgresNamedPlaceRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def candidates(
        self,
        name: str,
        bbox: tuple[float, float, float, float],
        target_key: str | None = None,
        target_values: Sequence[str] = (),
    ) -> tuple[NamedPlaceRecord, ...]:
        fragment = _fragment(name)
        if len(fragment) < 3:
            return ()
        params = _params(bbox) | {
            "fragment": fragment,
            "name": name,
            "target_key": target_key,
            "target_values": list(target_values),
        }
        rows = await (await self._connection.execute(CANDIDATE_LOOKUP, params)).fetchall()
        return tuple(
            NamedPlaceRecord(
                id=str(row[0]),
                name=str(row[1]),
                location=(float(str(row[2])), float(str(row[3]))),
                tags={str(k): str(v) for k, v in row[4].items()}
                if isinstance(row[4], dict)
                else {},
            )
            for row in rows
        )

    async def geographic_name(self, name: str) -> NamedPlaceRecord | None:
        rows = await (await self._connection.execute(GEOGRAPHIC_NAME, {"name": name})).fetchall()
        return _record(rows[0]) if len(rows) == 1 else None

    async def by_name(
        self,
        name: str,
        bbox: tuple[float, float, float, float],
        target_key: str | None = None,
        target_values: Sequence[str] = (),
    ) -> NamedPlaceRecord | None:
        params = _params(bbox) | {
            "name": name,
            "target_key": target_key,
            "target_values": list(target_values),
        }
        row = await (await self._connection.execute(NAME_LOOKUP, params)).fetchone()
        if row is None:
            row = await (await self._connection.execute(ALIAS_LOOKUP, params)).fetchone()
        if row is None:
            fragment = _fragment(name)
            if len(fragment) >= 5:
                row = await (
                    await self._connection.execute(FRAGMENT_LOOKUP, params | {"fragment": fragment})
                ).fetchone()
        if row is None and target_key is not None:
            rows = await (await self._connection.execute(TOKEN_LOOKUP, params)).fetchall()
            unique = len(rows) == 1 or (
                len(rows) == 2
                and (
                    float(str(rows[0][4])) > float(str(rows[1][4])) + 1e-9
                    or (bool(rows[0][5]) and not bool(rows[1][5]))
                )
            )
            row = rows[0] if unique else None
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
