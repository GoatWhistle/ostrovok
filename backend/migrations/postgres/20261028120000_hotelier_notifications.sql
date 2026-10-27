-- migrate:up
CREATE TABLE hotelier_notifications (
    id text PRIMARY KEY,
    hotel_id text NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    kind text NOT NULL,
    severity text NOT NULL,
    characteristic_key text,
    question_id text,
    fact_id text,
    conflict_id text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    dedup_key text NOT NULL,
    created_at timestamptz NOT NULL,
    read_at timestamptz
);
CREATE UNIQUE INDEX hotelier_notifications_dedup_idx
    ON hotelier_notifications (hotel_id, dedup_key);
CREATE INDEX hotelier_notifications_feed_idx
    ON hotelier_notifications (hotel_id, created_at DESC, id DESC);
CREATE INDEX hotelier_notifications_unread_idx
    ON hotelier_notifications (hotel_id, created_at DESC, id DESC) WHERE read_at IS NULL;

-- migrate:down
DROP TABLE hotelier_notifications;
