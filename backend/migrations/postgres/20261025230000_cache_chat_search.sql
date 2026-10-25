-- migrate:up
ALTER TABLE chat_conversations ADD COLUMN search_snapshot jsonb;

-- migrate:down
ALTER TABLE chat_conversations DROP COLUMN search_snapshot;
