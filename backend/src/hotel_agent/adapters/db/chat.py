from datetime import datetime

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.application.chat_records import ChatMessageRecord, ConversationRecord


class PostgresChatRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def get(self, conversation_id: str) -> ConversationRecord | None:
        row = await (
            await self._connection.execute(
                """SELECT id, region_id, effective_query, search_snapshot
                FROM chat_conversations WHERE id = %(id)s""",
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
            search_snapshot=row[3] if isinstance(row[3], dict) else None,
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
        search_snapshot: dict[str, object],
    ) -> None:
        await self._connection.execute(
            """INSERT INTO chat_conversations (id, region_id, effective_query, search_snapshot)
            VALUES (%(id)s, %(region)s, %(query)s, %(snapshot)s)
            ON CONFLICT (id) DO UPDATE SET effective_query = EXCLUDED.effective_query,
            search_snapshot = EXCLUDED.search_snapshot, updated_at = now()""",
            {
                "id": conversation_id,
                "region": region_id,
                "query": effective_query,
                "snapshot": Jsonb(search_snapshot),
            },
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

    async def save_search_snapshot(
        self, conversation_id: str, search_snapshot: dict[str, object]
    ) -> None:
        await self._connection.execute(
            """UPDATE chat_conversations SET search_snapshot = %(snapshot)s
            WHERE id = %(id)s AND search_snapshot IS NULL""",
            {"id": conversation_id, "snapshot": Jsonb(search_snapshot)},
        )
