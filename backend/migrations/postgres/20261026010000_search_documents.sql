-- migrate:up
ALTER TABLE hotel_supplier_content ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN details jsonb NOT NULL DEFAULT '{}';

CREATE VIEW hotel_search_documents AS
SELECT 'osm:' || h.id AS id, h.id AS hotel_id,
       (h.tags - 'name' - 'name:ru' - 'name:en' - 'brand' - 'operator')::text AS text,
       'OpenStreetMap' AS source
FROM hotels h
UNION ALL
SELECT 'supplier:' || c.supplier || ':' || c.hotel_id, c.hotel_id,
       (c.details - 'name' - 'id' - 'rooms' - 'hotelImages')::text, c.supplier
FROM hotel_supplier_content c WHERE c.details <> '{}'
UNION ALL
SELECT 'facilities:' || c.supplier || ':' || c.hotel_id, c.hotel_id,
       array_to_string(c.facilities_ru || c.facilities_en, '; '), c.supplier
FROM hotel_supplier_content c
WHERE cardinality(c.facilities_ru) + cardinality(c.facilities_en) > 0
UNION ALL
SELECT 'room:' || r.id, r.hotel_id,
       jsonb_build_object('name',r.name,'capacity',r.capacity,'floor_min',r.floor_min,
           'floor_max',r.floor_max,'included',r.included,'details',r.details)::text,
       CASE WHEN r.id LIKE 'nuitee:%' THEN 'nuitee' ELSE 'room_inventory' END
FROM rooms r;

-- migrate:down
DROP VIEW hotel_search_documents;
ALTER TABLE rooms DROP COLUMN details;
ALTER TABLE hotel_supplier_content DROP COLUMN details;
