-- migrate:up
ALTER TABLE buildings
    ADD COLUMN footprint_3857 geometry(MultiPolygon,3857)
        GENERATED ALWAYS AS (ST_Transform(footprint,3857)) STORED,
    ADD COLUMN overview_3857 geometry(MultiPolygon,3857)
        GENERATED ALWAYS AS (ST_SimplifyPreserveTopology(ST_Transform(footprint,3857),1)) STORED;
ALTER TABLE landcover
    ADD COLUMN geometry_3857 geometry(MultiPolygon,3857)
        GENERATED ALWAYS AS (ST_Transform(geometry,3857)) STORED;
ALTER TABLE water_areas
    ADD COLUMN geometry_3857 geometry(MultiPolygon,3857)
        GENERATED ALWAYS AS (ST_Transform(geometry,3857)) STORED;

-- migrate:down
ALTER TABLE water_areas DROP COLUMN geometry_3857;
ALTER TABLE landcover DROP COLUMN geometry_3857;
ALTER TABLE buildings DROP COLUMN overview_3857, DROP COLUMN footprint_3857;
