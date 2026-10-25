from datetime import UTC, datetime

from psycopg_pool import AsyncConnectionPool

from hotel_agent.application.ports.hotel_catalog import CatalogHotel


class PostgresHotelCatalog:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def save(self, hotel_id: str, hotel: CatalogHotel) -> int:
        async with self._pool.connection() as db:
            exists = await db.execute("SELECT 1 FROM hotels WHERE id = %s", (hotel_id,))
            if await exists.fetchone() is None:
                raise ValueError(f"Unknown hotel ID: {hotel_id}")
            await db.execute(
                """INSERT INTO hotel_supplier_refs (hotel_id, supplier, supplier_id, verified_at)
                VALUES (%s, 'nuitee', %s, %s)
                ON CONFLICT (hotel_id, supplier) DO UPDATE SET
                supplier_id = EXCLUDED.supplier_id, verified_at = EXCLUDED.verified_at""",
                (hotel_id, hotel.supplier_id, datetime.now(UTC)),
            )
            for room in hotel.rooms:
                await db.execute(
                    """INSERT INTO rooms
                    (id, hotel_id, name, capacity, floor_min, floor_max, synthetic, included)
                    VALUES (%s, %s, %s, %s, NULL, NULL, false, %s)
                    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                    capacity = EXCLUDED.capacity, included = EXCLUDED.included""",
                    (
                        f"nuitee:{hotel.supplier_id}:{room.supplier_id}",
                        hotel_id,
                        room.name,
                        room.max_adults,
                        list(room.amenities),
                    ),
                )
            if hotel.rooms:
                await db.execute(
                    """INSERT INTO facts
                    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
                     source_type, method, confidence, computed_at, valid_until, status, explanation)
                    VALUES (%s, 'hotel', %s, 'double_room', %s::jsonb, NULL,
                            '{"source":"room_inventory"}'::jsonb, 'computed',
                            'double_room@1', 0.85, now(), now() + interval '90 days',
                            'active', 'Вместимость проверена по категориям номеров Nuitee')
                    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value,
                    computed_at = EXCLUDED.computed_at, valid_until = EXCLUDED.valid_until,
                    explanation = EXCLUDED.explanation""",
                    (
                        f"f_double_room_{hotel_id}",
                        hotel_id,
                        "true" if any(room.max_adults == 2 for room in hotel.rooms) else "false",
                    ),
                )
        return len(hotel.rooms)
