-- migrate:up
CREATE TABLE named_place_aliases (
    alias text PRIMARY KEY,
    location geometry(Point, 4326) NOT NULL,
    source_url text NOT NULL
);

INSERT INTO named_place_aliases (alias, location, source_url) VALUES
    ('монумент дружбы народов', ST_SetSRID(ST_MakePoint(53.1969444, 56.8519444), 4326),
     'https://www.wikidata.org/wiki/Q4168756'),
    ('дружба народов', ST_SetSRID(ST_MakePoint(53.1969444, 56.8519444), 4326),
     'https://www.wikidata.org/wiki/Q4168756');

-- migrate:down
DROP TABLE named_place_aliases;
