-- migrate:up
ALTER TABLE pois ADD COLUMN class text NOT NULL DEFAULT 'default_poi';
ALTER TABLE pois ADD COLUMN class_source text NOT NULL DEFAULT 'tag';

-- migrate:down
ALTER TABLE pois DROP COLUMN class_source, DROP COLUMN class;
