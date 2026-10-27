from datetime import UTC, datetime

from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from hotel_agent.application.ports.hotel_catalog import CatalogHotel, CatalogMappingConflict


class PostgresHotelCatalog:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def save(self, hotel_id: str, hotel: CatalogHotel) -> int:
        try:
            return await self._save(hotel_id, hotel)
        except UniqueViolation as error:
            raise CatalogMappingConflict("Supplier hotel is already mapped") from error

    async def _save(self, hotel_id: str, hotel: CatalogHotel) -> int:
        async with self._pool.connection() as db:
            exists = await db.execute("SELECT 1 FROM hotels WHERE id = %s FOR UPDATE", (hotel_id,))
            if await exists.fetchone() is None:
                raise ValueError(f"Unknown hotel ID: {hotel_id}")
            refs = await db.execute(
                "SELECT supplier_id FROM hotel_supplier_refs WHERE hotel_id = %s AND supplier = 'nuitee'",
                (hotel_id,),
            )
            existing = await refs.fetchone()
            if existing is not None and existing[0] != hotel.supplier_id:
                raise CatalogMappingConflict("Local hotel already has a different supplier ID")
            await db.execute(
                """INSERT INTO hotel_supplier_refs (hotel_id, supplier, supplier_id, verified_at)
                VALUES (%s, 'nuitee', %s, %s)
                ON CONFLICT (hotel_id, supplier) DO UPDATE SET
                supplier_id = EXCLUDED.supplier_id, verified_at = EXCLUDED.verified_at""",
                (hotel_id, hotel.supplier_id, datetime.now(UTC)),
            )
            await db.execute(
                """INSERT INTO hotel_supplier_content
                (hotel_id, supplier, facilities_ru, facilities_en, details)
                VALUES (%s, 'nuitee', %s, %s, %s)
                ON CONFLICT (hotel_id, supplier) DO UPDATE SET
                facilities_ru = EXCLUDED.facilities_ru,
                facilities_en = EXCLUDED.facilities_en,
                details = EXCLUDED.details,
                updated_at = now()""",
                (
                    hotel_id,
                    list(hotel.facilities_ru),
                    list(hotel.facilities_en),
                    Jsonb(hotel.details),
                ),
            )
            for room in hotel.rooms:
                await db.execute(
                    """INSERT INTO rooms
                    (id, hotel_id, name, capacity, floor_min, floor_max, synthetic, included, details)
                    VALUES (%s, %s, %s, %s, NULL, NULL, false, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                    capacity = EXCLUDED.capacity, included = EXCLUDED.included,
                    details = EXCLUDED.details""",
                    (
                        f"nuitee:{hotel.supplier_id}:{room.supplier_id}",
                        hotel_id,
                        room.name,
                        room.max_adults,
                        list(room.amenities),
                        Jsonb(room.details),
                    ),
                )
            if hotel.rooms:
                await db.execute(
                    """INSERT INTO facts
                    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
                     source_type, method, confidence, computed_at, valid_until, status, explanation)
                    SELECT %(id)s, 'hotel', %(hotel)s, 'double_room', %(value)s::jsonb, NULL,
                            '{"source":"room_inventory"}'::jsonb, 'computed',
                            'double_room@1', 0.85, now(), now() + interval '90 days',
                            'active', 'Вместимость проверена по категориям номеров Nuitee'
                    WHERE NOT EXISTS (SELECT 1 FROM facts kept
                        WHERE kept.subject_type = 'hotel' AND kept.subject_id = %(hotel)s
                        AND kept.characteristic_key = 'double_room' AND kept.id <> %(id)s
                        AND kept.status <> 'superseded')
                    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value,
                    computed_at = EXCLUDED.computed_at, valid_until = EXCLUDED.valid_until,
                    explanation = EXCLUDED.explanation
                    WHERE facts.status = 'active'""",
                    {
                        "id": f"f_double_room_{hotel_id}",
                        "hotel": hotel_id,
                        "value": "true"
                        if any(room.max_adults == 2 for room in hotel.rooms)
                        else "false",
                    },
                )
                await db.execute(
                    """INSERT INTO facts
                    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers,
                     source_type, method, confidence, computed_at, valid_until, status, explanation)
                    SELECT %(id)s, 'hotel', %(hotel)s, 'room_capacity', %(value)s::jsonb, NULL,
                            '{"source":"room_inventory"}'::jsonb, 'computed',
                            'room_capacity@1', 0.85, now(), now() + interval '90 days',
                            'active', 'Вместимость одной категории номера по каталогу Nuitee'
                    WHERE NOT EXISTS (SELECT 1 FROM facts kept
                        WHERE kept.subject_type = 'hotel' AND kept.subject_id = %(hotel)s
                        AND kept.characteristic_key = 'room_capacity' AND kept.id <> %(id)s
                        AND kept.status <> 'superseded')
                    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value,
                    unit = EXCLUDED.unit,
                    computed_at = EXCLUDED.computed_at, valid_until = EXCLUDED.valid_until,
                    explanation = EXCLUDED.explanation
                    WHERE facts.status = 'active'""",
                    {
                        "id": f"f_room_capacity_{hotel_id}",
                        "hotel": hotel_id,
                        "value": str(max(room.max_adults for room in hotel.rooms)),
                    },
                )
        return len(hotel.rooms)
