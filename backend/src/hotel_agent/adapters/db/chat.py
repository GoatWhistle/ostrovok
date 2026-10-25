from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.application.chat_records import ChatMessageRecord, ConversationRecord


class PostgresChatRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def get(self, conversation_id: str) -> ConversationRecord | None:
        row = await (
            await self._connection.execute(
                "SELECT id, region_id, effective_query FROM chat_conversations WHERE id = %(id)s",
                {"id": conversation_id},
            )
        ).fetchone()
        if row is None:
            return None
        rows = await (
            await self._connection.execute(
                """SELECT id, role, content, created_at FROM chat_messages
                WHERE conversation_id = %(id)s ORDER BY created_at, id""",
                {"id": conversation_id},
            )
        ).fetchall()
        messages = []
        for item in rows:
            assert isinstance(item[3], datetime)
            messages.append(
                ChatMessageRecord(
                    id=str(item[0]), role=str(item[1]), content=str(item[2]), created_at=item[3]
                )
            )
        return ConversationRecord(
            id=str(row[0]),
            region_id=str(row[1]),
            effective_query=str(row[2]) if row[2] is not None else None,
            messages=tuple(messages),
        )

    async def save(
        self,
        conversation_id: str,
        region_id: str,
        effective_query: str,
        user_message_id: str,
        user_text: str,
        answer_id: str,
        answer: str,
    ) -> None:
        await self._connection.execute(
            """INSERT INTO chat_conversations (id, region_id, effective_query)
            VALUES (%(id)s, %(region)s, %(query)s)
            ON CONFLICT (id) DO UPDATE SET effective_query = EXCLUDED.effective_query,
            updated_at = now()""",
            {"id": conversation_id, "region": region_id, "query": effective_query},
        )
        async with self._connection.cursor() as cursor:
            await cursor.executemany(
                """INSERT INTO chat_messages (id, conversation_id, role, content)
                VALUES (%(id)s, %(conversation)s, %(role)s, %(content)s)""",
                [
                    {
                        "id": user_message_id,
                        "conversation": conversation_id,
                        "role": "user",
                        "content": user_text,
                    },
                    {
                        "id": answer_id,
                        "conversation": conversation_id,
                        "role": "assistant",
                        "content": answer,
                    },
                ],
            )
