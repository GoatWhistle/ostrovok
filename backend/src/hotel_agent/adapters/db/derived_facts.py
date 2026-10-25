from collections.abc import Sequence

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.application.dto import SearchFactRecord


async def save_derived_facts(
    connection: AsyncConnection[tuple[object, ...]], records: Sequence[SearchFactRecord]
) -> None:
    for row in records:
        if not row.characteristic_key.startswith("derived:"):
            raise ValueError("Only derived search evidence can be saved")
    async with connection.cursor() as cursor:
        await cursor.executemany(
            """INSERT INTO facts
            (id,subject_type,subject_id,characteristic_key,value,unit,qualifiers,source_type,
             source_id,method,confidence,computed_at,valid_until,status,geo_refs,explanation)
            VALUES (%s,'hotel',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value,qualifiers=EXCLUDED.qualifiers,
                source_id=EXCLUDED.source_id,confidence=EXCLUDED.confidence,
                computed_at=EXCLUDED.computed_at,valid_until=EXCLUDED.valid_until,
                geo_refs=EXCLUDED.geo_refs,explanation=EXCLUDED.explanation""",
            [
                (
                    r.id,
                    r.hotel_id,
                    r.characteristic_key,
                    Jsonb(r.value),
                    r.unit,
                    Jsonb(r.qualifiers),
                    r.source_type,
                    r.source_id,
                    r.method,
                    r.confidence,
                    r.computed_at,
                    r.valid_until,
                    r.status,
                    list(r.geo_refs),
                    r.explanation,
                )
                for r in records
            ],
        )
