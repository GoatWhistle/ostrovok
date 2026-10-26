-- migrate:up
ALTER TABLE chat_conversations ADD COLUMN title text;

-- migrate:down
ALTER TABLE chat_conversations DROP COLUMN title;
