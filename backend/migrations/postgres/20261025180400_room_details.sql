-- migrate:up
ALTER TABLE rooms ADD COLUMN price_amount numeric(12, 2);
ALTER TABLE rooms ADD COLUMN price_currency text;
ALTER TABLE rooms ADD COLUMN included text[] NOT NULL DEFAULT '{}';
ALTER TABLE rooms ADD CONSTRAINT rooms_price_nonnegative CHECK (price_amount >= 0);

-- migrate:down
ALTER TABLE rooms DROP CONSTRAINT rooms_price_nonnegative;
ALTER TABLE rooms DROP COLUMN included;
ALTER TABLE rooms DROP COLUMN price_currency;
ALTER TABLE rooms DROP COLUMN price_amount;
