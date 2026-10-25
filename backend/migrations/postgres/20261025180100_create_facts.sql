-- migrate:up
CREATE TABLE geo_features (
    id text PRIMARY KEY,
    kind text NOT NULL,
    characteristic_key text NOT NULL,
    geometry geometry(Geometry, 4326) NOT NULL,
    name text,
    label text,
    osm_ref text,
    style_hint text
);
CREATE INDEX geo_features_geometry_gist ON geo_features USING gist (geometry);

CREATE TABLE facts (
    id text PRIMARY KEY,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    characteristic_key text NOT NULL,
    value jsonb,
    unit text,
    qualifiers jsonb NOT NULL DEFAULT '{}',
    source_type text NOT NULL,
    source_id text,
    method text,
    confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    computed_at timestamptz NOT NULL,
    valid_until timestamptz,
    status text NOT NULL DEFAULT 'active',
    geo_refs text[] NOT NULL DEFAULT '{}',
    explanation text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX facts_active_subject_characteristic_uq
    ON facts (subject_type, subject_id, characteristic_key)
    WHERE status IN ('active', 'confirmed_by_hotelier');
CREATE INDEX facts_subject_idx ON facts (subject_type, subject_id);
CREATE INDEX facts_source_validity_idx ON facts (source_type, valid_until);

CREATE TABLE conflicts (
    id text PRIMARY KEY,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    characteristic_key text NOT NULL,
    fact_ids text[] NOT NULL,
    resolution text NOT NULL,
    rule text NOT NULL,
    winner_fact_id text REFERENCES facts(id)
);
CREATE INDEX conflicts_subject_idx ON conflicts (subject_type, subject_id);

CREATE TABLE hotelier_questions (
    id text PRIMARY KEY,
    hotel_id text NOT NULL REFERENCES hotels(id),
    characteristic_key text NOT NULL,
    text text NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'open',
    answer_text text
);
CREATE INDEX hotelier_questions_hotel_status_idx ON hotelier_questions (hotel_id, status);

-- migrate:down
DROP TABLE hotelier_questions;
DROP TABLE conflicts;
DROP TABLE facts;
DROP TABLE geo_features;
