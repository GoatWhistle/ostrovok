-- migrate:up
CREATE INDEX pois_geographic_names_gin ON pois USING gin ((ARRAY[
    translate(lower(tags->>'name'), 'ё', 'е'),
    translate(lower(tags->>'name:ru'), 'ё', 'е'),
    translate(lower(tags->>'alt_name'), 'ё', 'е')
])) WHERE tags ? 'name' AND tags ?| ARRAY['natural','waterway','tourism','historic','place'];

-- migrate:down
DROP INDEX pois_geographic_names_gin;
