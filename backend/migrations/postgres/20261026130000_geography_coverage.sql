-- migrate:up
CREATE TABLE geography_coverage (
    id text PRIMARY KEY,
    bbox geometry(Polygon, 4326) NOT NULL,
    source_url text NOT NULL,
    fetched_at timestamptz NOT NULL,
    valid_until timestamptz NOT NULL,
    complete boolean NOT NULL,
    counts jsonb NOT NULL,
    CONSTRAINT geography_coverage_validity CHECK (valid_until > fetched_at)
);
CREATE INDEX geography_coverage_bbox_gist ON geography_coverage USING gist (bbox);

-- migrate:down
DROP TABLE geography_coverage;
