-- migrate:up
CREATE TABLE chat_conversations (
    id uuid PRIMARY KEY,
    region_id text NOT NULL REFERENCES regions(id),
    effective_query text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chat_messages (
    id uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conversation_idx ON chat_messages (conversation_id, created_at, id);

-- migrate:down
DROP TABLE chat_messages;
DROP TABLE chat_conversations;
