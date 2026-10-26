from psycopg import AsyncConnection

TILE_SQL = """
WITH bounds AS (
    SELECT ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS geom
), roads AS (
    SELECT ST_AsMVTGeom(ST_Transform(w.geometry, 3857), bounds.geom) AS geom,
        w.tags->>'highway' AS kind, w.class, w.class_source
    FROM walk_edges w CROSS JOIN bounds
    WHERE w.geometry && ST_Transform(bounds.geom, 4326)
      AND (%(z)s >= 13 OR w.tags->>'highway' IN
          ('primary', 'secondary', 'tertiary', 'trunk', 'motorway'))
), shore AS (
    SELECT ST_AsMVTGeom(ST_Transform(c.geometry, 3857), bounds.geom) AS geom
    FROM coastline c CROSS JOIN bounds
    WHERE c.geometry && ST_Transform(bounds.geom, 4326)
), beach AS (
    SELECT ST_AsMVTGeom(ST_Transform(b.geometry, 3857), bounds.geom) AS geom
    FROM beaches b CROSS JOIN bounds
    WHERE b.geometry && ST_Transform(bounds.geom, 4326)
), structures AS (
    SELECT ST_AsMVTGeom(ST_Transform(b.footprint, 3857), bounds.geom) AS geom, b.class, b.class_source, b.height_m, b.levels, b.height_source
    FROM buildings b CROSS JOIN bounds
    WHERE %(z)s >= 15 AND b.footprint && ST_Transform(bounds.geom, 4326)
), ground AS (
    SELECT ST_AsMVTGeom(CASE WHEN %(z)s < 14 THEN ST_SimplifyPreserveTopology(ST_Transform(l.geometry,3857), 10) ELSE ST_Transform(l.geometry,3857) END,bounds.geom) AS geom,
        l.class,l.class_source
    FROM landcover l CROSS JOIN bounds WHERE l.geometry && ST_Transform(bounds.geom,4326)
), water AS (
    SELECT ST_AsMVTGeom(CASE WHEN %(z)s < 14 THEN ST_SimplifyPreserveTopology(ST_Transform(w.geometry,3857), 10) ELSE ST_Transform(w.geometry,3857) END,bounds.geom) AS geom,
        w.class,w.class_source
    FROM water_areas w CROSS JOIN bounds WHERE w.geometry && ST_Transform(bounds.geom,4326)
), plants AS (
    SELECT ST_AsMVTGeom(ST_Transform(t.geometry,3857),bounds.geom) AS geom,t.class
    FROM trees t CROSS JOIN bounds WHERE %(z)s >= 15 AND t.geometry && ST_Transform(bounds.geom,4326)
)
SELECT COALESCE((SELECT ST_AsMVT(roads, 'roads') FROM roads), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(shore, 'coastline') FROM shore), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(beach, 'beaches') FROM beach), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(structures, 'buildings') FROM structures), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(ground, 'landcover') FROM ground), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(water, 'water') FROM water), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(plants, 'trees') FROM plants), '\\x'::bytea)
"""


class PostgresMapTileRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def get(self, z: int, x: int, y: int) -> bytes:
        result = await self._connection.execute(TILE_SQL, {"z": z, "x": x, "y": y})
        row = await result.fetchone()
        value = row[0] if row else None
        if isinstance(value, (bytes, bytearray, memoryview)):
            return bytes(value)
        return b""
