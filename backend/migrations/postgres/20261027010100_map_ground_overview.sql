-- migrate:up
ALTER TABLE landcover ADD COLUMN overview_3857 geometry(MultiPolygon,3857)
    GENERATED ALWAYS AS (ST_SimplifyPreserveTopology(ST_Transform(geometry,3857),5)) STORED;

-- migrate:down
ALTER TABLE landcover DROP COLUMN overview_3857;
