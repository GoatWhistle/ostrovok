from collections.abc import Sequence

from psycopg import AsyncConnection

from hotel_agent.application.ports.semantic_search import SearchDocument


class PostgresSearchDocuments:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list(self, hotel_ids: Sequence[str] | None = None) -> Sequence[SearchDocument]:
        cursor = await self._connection.execute(
            "SELECT id,hotel_id,text,source FROM hotel_search_documents "
            "WHERE (%(ids)s::text[] IS NULL OR hotel_id=ANY(%(ids)s::text[])) ORDER BY id",
            {"ids": list(hotel_ids) if hotel_ids is not None else None},
        )
        return [
            SearchDocument(id=str(r[0]), hotel_id=str(r[1]), text=str(r[2]), source=str(r[3]))
            for r in await cursor.fetchall()
        ]
