from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.application.ports.hotelier_entries import HotelierEntry


class PostgresHotelierEntries:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def for_hotel(self, hotel_id: str) -> Sequence[HotelierEntry]:
        cursor = await self._connection.execute(
            "SELECT id, hotel_id, title, description, updated_at FROM hotelier_entries "
            "WHERE hotel_id = %s ORDER BY created_at, id",
            (hotel_id,),
        )
        return [_entry(row) for row in await cursor.fetchall()]

    async def save(self, entry: HotelierEntry) -> None:
        await self._connection.execute(
            "INSERT INTO hotelier_entries "
            "(id, hotel_id, title, description, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (hotel_id, id) DO UPDATE SET "
            "title = EXCLUDED.title, description = EXCLUDED.description, "
            "updated_at = EXCLUDED.updated_at",
            (
                entry.id,
                entry.hotel_id,
                entry.title,
                entry.description,
                entry.updated_at,
                entry.updated_at,
            ),
        )


def _entry(row: tuple[object, ...]) -> HotelierEntry:
    assert isinstance(row[4], datetime)
    return HotelierEntry(str(row[0]), str(row[1]), str(row[2]), str(row[3]), row[4])
