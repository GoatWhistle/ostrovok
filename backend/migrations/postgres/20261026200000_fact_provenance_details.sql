-- migrate:up
ALTER TABLE facts ADD COLUMN source_url text;
ALTER TABLE facts ADD COLUMN observed_at timestamptz;
ALTER TABLE facts ADD COLUMN evidence jsonb NOT NULL DEFAULT '[]';
ALTER TABLE hotelier_questions ADD COLUMN answered_at timestamptz;
CREATE INDEX facts_subject_characteristic_idx
    ON facts (subject_type, subject_id, characteristic_key);
CREATE INDEX conflicts_fact_ids_gin ON conflicts USING gin (fact_ids);

-- migrate:down
DROP INDEX conflicts_fact_ids_gin;
DROP INDEX facts_subject_characteristic_idx;
ALTER TABLE hotelier_questions DROP COLUMN answered_at;
ALTER TABLE facts DROP COLUMN evidence;
ALTER TABLE facts DROP COLUMN observed_at;
ALTER TABLE facts DROP COLUMN source_url;
