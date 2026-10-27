-- migrate:up
CREATE INDEX pois_place_location_gist ON pois USING gist (location) WHERE tags ? 'place';

-- migrate:down
DROP INDEX pois_place_location_gist;
