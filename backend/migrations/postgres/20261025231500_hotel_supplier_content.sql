-- migrate:up
CREATE TABLE hotel_supplier_content (
    hotel_id text NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    supplier text NOT NULL,
    facilities_ru text[] NOT NULL DEFAULT '{}',
    facilities_en text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hotel_id, supplier)
);

-- migrate:down
DROP TABLE hotel_supplier_content;
