-- migrate:up
CREATE TABLE prop_lines (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiLineString,4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}',
    class text NOT NULL,
    class_source text NOT NULL DEFAULT 'tag'
);
CREATE INDEX prop_lines_geometry_gist ON prop_lines USING gist (geometry);
CREATE INDEX prop_lines_region_idx ON prop_lines (region_id);

-- migrate:down
DROP TABLE prop_lines;
