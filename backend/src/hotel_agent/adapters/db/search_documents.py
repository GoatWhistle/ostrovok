from collections.abc import Sequence

from psycopg import AsyncConnection

from hotel_agent.application.ports.semantic_search import SearchDocument


class PostgresSearchDocuments:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list(self, hotel_ids: Sequence[str] | None = None) -> Sequence[SearchDocument]:
        cursor = await self._connection.execute(
            "SELECT d.id,d.hotel_id,d.text,d.source,h.name,h.tags->>'website' "
            "FROM hotel_search_documents d JOIN hotels h ON h.id=d.hotel_id "
            "WHERE (%(ids)s::text[] IS NULL OR d.hotel_id=ANY(%(ids)s::text[])) ORDER BY d.id",
            {"ids": list(hotel_ids) if hotel_ids is not None else None},
        )
        return [
            SearchDocument(
                id=str(r[0]),
                hotel_id=str(r[1]),
                text=str(r[2]),
                source=str(r[3]),
                hotel_name=str(r[4]),
                website=str(r[5]) if r[5] else None,
            )
            for r in await cursor.fetchall()
        ]
