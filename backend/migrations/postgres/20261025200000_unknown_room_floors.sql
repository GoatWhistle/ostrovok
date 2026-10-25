-- migrate:up
ALTER TABLE rooms ALTER COLUMN floor_min DROP NOT NULL;
ALTER TABLE rooms ALTER COLUMN floor_max DROP NOT NULL;

-- migrate:down
DELETE FROM rooms WHERE floor_min IS NULL OR floor_max IS NULL;
ALTER TABLE rooms ALTER COLUMN floor_min SET NOT NULL;
ALTER TABLE rooms ALTER COLUMN floor_max SET NOT NULL;
