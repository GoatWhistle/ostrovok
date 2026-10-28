-- migrate:up
CREATE TABLE hotelier_entries (
    hotel_id text NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    id uuid NOT NULL,
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
    description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (hotel_id, id)
);

-- migrate:down
DROP TABLE hotelier_entries;
