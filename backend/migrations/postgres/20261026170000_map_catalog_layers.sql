-- migrate:up
ALTER TABLE buildings ADD COLUMN class text NOT NULL DEFAULT 'default_volume';
ALTER TABLE buildings ADD COLUMN class_source text NOT NULL DEFAULT 'default';
ALTER TABLE buildings ADD COLUMN height_source text NOT NULL DEFAULT 'unknown';
ALTER TABLE walk_edges ADD COLUMN class text NOT NULL DEFAULT 'default_ground';
ALTER TABLE walk_edges ADD COLUMN class_source text NOT NULL DEFAULT 'tag';

CREATE TABLE landcover (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiPolygon,4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}',
    class text NOT NULL,
    class_source text NOT NULL DEFAULT 'tag'
);
CREATE INDEX landcover_geometry_gist ON landcover USING gist (geometry);
CREATE INDEX landcover_region_idx ON landcover (region_id);

CREATE TABLE water_areas (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiPolygon,4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}',
    class text NOT NULL DEFAULT 'water',
    class_source text NOT NULL DEFAULT 'tag'
);
CREATE INDEX water_areas_geometry_gist ON water_areas USING gist (geometry);
CREATE INDEX water_areas_region_idx ON water_areas (region_id);

CREATE TABLE trees (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(Point,4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}',
    class text NOT NULL DEFAULT 'tree',
    class_source text NOT NULL DEFAULT 'tag'
);
CREATE INDEX trees_geometry_gist ON trees USING gist (geometry);

-- migrate:down
DROP TABLE trees;
DROP TABLE water_areas;
DROP TABLE landcover;
ALTER TABLE walk_edges DROP COLUMN class_source, DROP COLUMN class;
ALTER TABLE buildings DROP COLUMN height_source, DROP COLUMN class_source, DROP COLUMN class;
