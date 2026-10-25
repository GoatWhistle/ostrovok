-- migrate:up
CREATE TABLE hotel_supplier_refs (
    hotel_id text NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    supplier text NOT NULL,
    supplier_id text NOT NULL,
    verified_at timestamptz NOT NULL,
    PRIMARY KEY (hotel_id, supplier),
    UNIQUE (supplier, supplier_id)
);

-- migrate:down
DROP TABLE hotel_supplier_refs;
