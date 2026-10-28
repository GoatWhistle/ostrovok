from psycopg import AsyncConnection

TILE_SQL = """
WITH bounds AS (
    SELECT ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS geom,
        ST_Transform(ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => 0.015625), 4326) AS query,
        40075016.68557849 / power(2, %(z)s) / 4096 AS unit
), roads AS (
    SELECT ST_AsMVTGeom(
        CASE WHEN %(z)s < 13
            THEN ST_Simplify(ST_Transform(w.geometry, 3857), bounds.unit)
            ELSE ST_Transform(w.geometry, 3857) END,
        bounds.geom, 4096, 64
    ) AS geom,
        w.tags->>'highway' AS kind, w.class, w.class_source
    FROM walk_edges w CROSS JOIN bounds
    WHERE %(z)s >= 8 AND w.geometry && bounds.query
      AND (%(z)s >= 13
          OR (%(z)s >= 11 AND w.tags->>'highway' IN ('secondary', 'tertiary'))
          OR (%(z)s >= 10 AND w.tags->>'highway' = 'primary')
          OR w.tags->>'highway' IN ('trunk', 'motorway'))
), shore AS (
    SELECT ST_AsMVTGeom(
        CASE WHEN %(z)s < 13
            THEN ST_Simplify(ST_Transform(c.geometry, 3857), bounds.unit)
            ELSE ST_Transform(c.geometry, 3857) END,
        bounds.geom, 4096, 64
    ) AS geom
    FROM coastline c CROSS JOIN bounds
    WHERE %(z)s >= 8 AND c.geometry && bounds.query
), beach AS (
    SELECT ST_AsMVTGeom(ST_Transform(b.geometry, 3857), bounds.geom, 4096, 64) AS geom
    FROM beaches b CROSS JOIN bounds WHERE b.geometry && bounds.query
), structures AS (
    SELECT b.id,
        ST_AsMVTGeom(
            CASE WHEN %(z)s < 14 THEN b.overview_3857 ELSE b.footprint_3857 END,
            bounds.geom, 4096, 64
        ) AS geom,
        b.class, b.class_source, b.height_m, b.levels, b.height_source
    FROM buildings b CROSS JOIN bounds
    WHERE %(z)s >= 10 AND b.footprint && bounds.query
        AND (%(z)s >= 12 OR ST_Area(b.footprint_3857) >= power(bounds.unit * 4, 2))
), ground AS (
    SELECT l.id,
        ST_AsMVTGeom(
            CASE WHEN %(z)s < 12
                THEN ST_SimplifyPreserveTopology(l.overview_3857, bounds.unit)
                WHEN %(z)s < 14 THEN l.overview_3857
                ELSE l.geometry_3857 END,
            bounds.geom, 4096, 64
        ) AS geom, l.class, l.class_source
    FROM landcover l CROSS JOIN bounds
    WHERE l.geometry && bounds.query
        AND (%(z)s >= 12 OR l.class IN ('residential', 'commercial', 'industrial'))
), water AS (
    SELECT ST_AsMVTGeom(
        CASE WHEN %(z)s < 14
            THEN ST_SimplifyPreserveTopology(w.geometry_3857, bounds.unit)
            ELSE w.geometry_3857 END,
        bounds.geom, 4096, 64
    ) AS geom, w.class, w.class_source
    FROM water_areas w CROSS JOIN bounds WHERE w.geometry && bounds.query
), plants AS (
    SELECT ST_AsMVTGeom(ST_Transform(t.geometry, 3857), bounds.geom, 4096, 64) AS geom,
        t.class
    FROM trees t CROSS JOIN bounds
    WHERE %(z)s >= 15 AND t.geometry && bounds.query
), alleys AS (
    SELECT ST_AsMVTGeom(ST_Transform(p.geometry, 3857), bounds.geom, 4096, 64) AS geom,
        p.class, p.class_source
    FROM prop_lines p CROSS JOIN bounds
    WHERE %(z)s >= 14 AND p.geometry && bounds.query
), props AS (
    SELECT ST_AsMVTGeom(ST_Transform(p.location, 3857), bounds.geom, 4096, 64) AS geom,
        p.class, p.class_source,
        COALESCE(
            p.tags->>'natural', p.tags->>'tourism', p.tags->>'amenity',
            p.tags->>'leisure', p.tags->>'man_made', p.tags->>'historic'
        ) AS kind,
        p.tags->>'name' AS name
    FROM pois p CROSS JOIN bounds
    WHERE %(z)s >= 16 AND p.location && bounds.query
        AND (p.tags->>'natural' IN ('waterfall', 'spring', 'cave_entrance')
            OR p.tags->>'tourism' IN ('viewpoint', 'artwork')
            OR p.tags->>'amenity' IN ('fountain', 'bench', 'drinking_water')
            OR p.tags->>'leisure' = 'playground'
            OR p.tags->>'man_made' = 'lighthouse'
            OR p.tags ? 'historic')
)
SELECT COALESCE((SELECT ST_AsMVT(roads, 'roads') FROM roads), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(shore, 'coastline') FROM shore), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(beach, 'beaches') FROM beach), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(structures, 'buildings') FROM structures), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(ground, 'landcover') FROM ground), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(water, 'water') FROM water), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(plants, 'trees') FROM plants), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(alleys, 'tree_rows') FROM alleys), '\\x'::bytea)
    || COALESCE((SELECT ST_AsMVT(props, 'props') FROM props), '\\x'::bytea)
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
