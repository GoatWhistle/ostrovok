from collections.abc import Sequence

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.adapters.db.search_facts import fact_record
from hotel_agent.application.dto import ConflictRecord, SearchFactRecord

OWNED_FACTS = """SELECT COALESCE(h.id, fa.hotel_id), f.id, f.characteristic_key, f.value, f.unit,
    f.qualifiers, f.source_type, f.source_id, f.method, f.confidence, f.computed_at,
    f.valid_until, f.status, f.geo_refs, f.explanation, fa.azimuth_deg, f.subject_id,
    f.source_url, f.observed_at, f.evidence
FROM facts f
LEFT JOIN hotels h ON f.subject_type = 'hotel' AND h.id = f.subject_id
LEFT JOIN facades fa ON f.subject_type = 'facade' AND fa.id = f.subject_id
WHERE (h.id IS NOT NULL OR fa.id IS NOT NULL)"""

GET_FACT = OWNED_FACTS + " AND f.id = %(id)s"

FACT_VERSIONS = (
    OWNED_FACTS
    + """ AND f.subject_type = %(type)s AND f.subject_id = %(subject)s
    AND f.characteristic_key = %(key)s
ORDER BY f.computed_at DESC, f.id"""
)

SAVE_FACT = """INSERT INTO facts
    (id, subject_type, subject_id, characteristic_key, value, unit, qualifiers, source_type,
     source_id, method, confidence, computed_at, valid_until, status, geo_refs, explanation,
     source_url, observed_at, evidence)
VALUES (%(id)s, %(type)s, %(subject)s, %(key)s, %(value)s, %(unit)s, %(qualifiers)s,
    %(source_type)s, %(source_id)s, %(method)s, %(confidence)s, %(computed_at)s,
    %(valid_until)s, %(status)s, %(geo_refs)s, %(explanation)s, %(source_url)s,
    %(observed_at)s, %(evidence)s)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit,
    qualifiers = EXCLUDED.qualifiers, source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id, method = EXCLUDED.method,
    confidence = EXCLUDED.confidence, computed_at = EXCLUDED.computed_at,
    valid_until = EXCLUDED.valid_until, status = EXCLUDED.status,
    geo_refs = EXCLUDED.geo_refs, explanation = EXCLUDED.explanation,
    source_url = EXCLUDED.source_url, observed_at = EXCLUDED.observed_at,
    evidence = EXCLUDED.evidence"""

HOTEL_CONFLICTS = """SELECT c.id, c.subject_type, c.subject_id, c.characteristic_key, c.fact_ids,
    c.resolution, c.rule, c.winner_fact_id
FROM conflicts c
WHERE ((c.subject_type = 'hotel' AND c.subject_id = %(hotel)s)
    OR (c.subject_type = 'facade'
        AND c.subject_id IN (SELECT id FROM facades WHERE hotel_id = %(hotel)s)))
  AND (%(fact)s::text IS NULL OR %(fact)s::text = ANY(c.fact_ids))
ORDER BY c.id"""

SAVE_CONFLICT = """INSERT INTO conflicts
    (id, subject_type, subject_id, characteristic_key, fact_ids, resolution, rule,
     winner_fact_id)
VALUES (%(id)s, %(type)s, %(subject)s, %(key)s, %(fact_ids)s, %(resolution)s, %(rule)s,
    %(winner)s)
ON CONFLICT (id) DO UPDATE SET fact_ids = EXCLUDED.fact_ids,
    resolution = EXCLUDED.resolution, rule = EXCLUDED.rule,
    winner_fact_id = EXCLUDED.winner_fact_id"""


class PostgresFactStore:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def lock_hotel(self, hotel_id: str) -> bool:
        cursor = await self._connection.execute(
            "SELECT id FROM hotels WHERE id = %(id)s FOR UPDATE", {"id": hotel_id}
        )
        return await cursor.fetchone() is not None

    async def get(self, fact_id: str, lock: bool = False) -> SearchFactRecord | None:
        cursor = await self._connection.execute(
            GET_FACT + (" FOR UPDATE OF f" if lock else ""), {"id": fact_id}
        )
        row = await cursor.fetchone()
        return fact_record(row) if row else None

    async def versions(
        self, subject_type: str, subject_id: str, characteristic_key: str
    ) -> Sequence[SearchFactRecord]:
        cursor = await self._connection.execute(
            FACT_VERSIONS,
            {"type": subject_type, "subject": subject_id, "key": characteristic_key},
        )
        return [fact_record(row) for row in await cursor.fetchall()]

    async def save(self, records: Sequence[SearchFactRecord]) -> None:
        for record in records:
            await self._connection.execute(SAVE_FACT, _fact_params(record))

    async def conflicts(
        self, hotel_id: str, fact_id: str | None = None
    ) -> Sequence[ConflictRecord]:
        cursor = await self._connection.execute(
            HOTEL_CONFLICTS, {"hotel": hotel_id, "fact": fact_id}
        )
        return [_conflict(row) for row in await cursor.fetchall()]

    async def save_conflicts(self, records: Sequence[ConflictRecord]) -> None:
        for record in records:
            await self._connection.execute(
                SAVE_CONFLICT,
                {
                    "id": record.id,
                    "type": record.subject_type,
                    "subject": record.subject_id,
                    "key": record.characteristic_key,
                    "fact_ids": list(record.fact_ids),
                    "resolution": record.resolution,
                    "rule": record.rule,
                    "winner": record.winner_fact_id,
                },
            )


def _fact_params(record: SearchFactRecord) -> dict[str, object]:
    return {
        "id": record.id,
        "type": "facade" if record.facade_azimuth is not None else "hotel",
        "subject": record.subject_id or record.hotel_id,
        "key": record.characteristic_key,
        "value": Jsonb(record.value),
        "unit": record.unit,
        "qualifiers": Jsonb(record.qualifiers),
        "source_type": record.source_type,
        "source_id": record.source_id,
        "method": record.method,
        "confidence": record.confidence,
        "computed_at": record.computed_at,
        "valid_until": record.valid_until,
        "status": record.status,
        "geo_refs": list(record.geo_refs),
        "explanation": record.explanation,
        "source_url": record.source_url,
        "observed_at": record.observed_at,
        "evidence": Jsonb([{"kind": kind, "text": text} for kind, text in record.evidence]),
    }


def _conflict(row: tuple[object, ...]) -> ConflictRecord:
    fact_ids = row[4] if isinstance(row[4], list | tuple) else ()
    return ConflictRecord(
        id=str(row[0]),
        subject_type=str(row[1]),
        subject_id=str(row[2]),
        characteristic_key=str(row[3]),
        fact_ids=tuple(str(item) for item in fact_ids),
        resolution=str(row[5]),
        rule=str(row[6]),
        winner_fact_id=str(row[7]) if row[7] is not None else None,
    )
