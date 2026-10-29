-- migrate:up
CREATE TABLE chat_owner_questions (
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    question_id text NOT NULL REFERENCES hotelier_questions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    notified_at timestamptz,
    PRIMARY KEY (conversation_id, question_id)
);
CREATE INDEX chat_owner_questions_waiting_idx
    ON chat_owner_questions (question_id) WHERE notified_at IS NULL;

-- migrate:down
DROP TABLE chat_owner_questions;
