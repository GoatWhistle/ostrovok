-- migrate:up
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE regions (
    id text PRIMARY KEY,
    name text NOT NULL,
    bbox geometry(Polygon, 4326) NOT NULL,
    built_at timestamptz NOT NULL
);
CREATE INDEX regions_bbox_gist ON regions USING gist (bbox);

CREATE TABLE buildings (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    footprint geometry(MultiPolygon, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}',
    height_m double precision,
    levels integer,
    hotel_id text
);
CREATE INDEX buildings_footprint_gist ON buildings USING gist (footprint);
CREATE INDEX buildings_region_idx ON buildings (region_id);

CREATE TABLE hotels (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    name text NOT NULL,
    location geometry(Point, 4326) NOT NULL,
    building_id text REFERENCES buildings(id),
    stars integer,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX hotels_location_gist ON hotels USING gist (location);
CREATE INDEX hotels_region_idx ON hotels (region_id);
CREATE INDEX hotels_building_idx ON hotels (building_id);
ALTER TABLE buildings ADD CONSTRAINT buildings_hotel_fk FOREIGN KEY (hotel_id) REFERENCES hotels(id);

CREATE TABLE facades (
    id text PRIMARY KEY,
    hotel_id text NOT NULL REFERENCES hotels(id),
    building_id text NOT NULL REFERENCES buildings(id),
    azimuth_deg double precision NOT NULL,
    label text NOT NULL,
    geometry geometry(LineString, 4326) NOT NULL
);
CREATE INDEX facades_geometry_gist ON facades USING gist (geometry);
CREATE INDEX facades_hotel_idx ON facades (hotel_id);

CREATE TABLE rooms (
    id text PRIMARY KEY,
    hotel_id text NOT NULL REFERENCES hotels(id),
    name text NOT NULL,
    capacity integer NOT NULL CHECK (capacity > 0),
    floor_min integer NOT NULL,
    floor_max integer NOT NULL,
    facade_ids text[] NOT NULL DEFAULT '{}',
    synthetic boolean NOT NULL DEFAULT true,
    CONSTRAINT rooms_floor_range CHECK (floor_min <= floor_max)
);
CREATE INDEX rooms_hotel_idx ON rooms (hotel_id);

CREATE TABLE pois (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    location geometry(Point, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX pois_location_gist ON pois USING gist (location);

CREATE TABLE coastline (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiLineString, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX coastline_geometry_gist ON coastline USING gist (geometry);

CREATE TABLE beaches (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiPolygon, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX beaches_geometry_gist ON beaches USING gist (geometry);

CREATE TABLE noise_sources (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiLineString, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX noise_sources_geometry_gist ON noise_sources USING gist (geometry);

CREATE TABLE walk_edges (
    id text PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    geometry geometry(MultiLineString, 4326) NOT NULL,
    tags jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX walk_edges_geometry_gist ON walk_edges USING gist (geometry);

-- migrate:down
DROP TABLE walk_edges;
DROP TABLE noise_sources;
DROP TABLE beaches;
DROP TABLE coastline;
DROP TABLE pois;
DROP TABLE rooms;
DROP TABLE facades;
DROP TABLE hotels;
DROP TABLE buildings;
DROP TABLE regions;
