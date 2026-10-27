from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.application.dto import QuestionCandidate, QuestionRecord

QUESTION_COLUMNS = """SELECT q.id, q.hotel_id, q.characteristic_key, q.text, q.reason, q.status,
    q.created_at, q.answer_text, q.answered_at,
    ARRAY(SELECT f.id FROM facts f WHERE f.source_type = 'hotelier' AND f.source_id = q.id
        ORDER BY f.computed_at, f.id) AS answer_fact_ids
FROM hotelier_questions q"""

HOTEL_QUESTIONS = QUESTION_COLUMNS + " WHERE q.hotel_id = %(hotel)s ORDER BY q.created_at, q.id"

GET_QUESTION = QUESTION_COLUMNS + " WHERE q.id = %(id)s"

RECORD_ANSWER = """UPDATE hotelier_questions
SET status = %(status)s, answer_text = %(answer)s, answered_at = %(at)s
WHERE id = %(id)s"""

SET_STATUS = "UPDATE hotelier_questions SET status = %(status)s WHERE id = %(id)s"

CANDIDATES = """SELECT h.id, h.name, k.key
FROM hotels h CROSS JOIN unnest(%(keys)s::text[]) AS k(key)
WHERE h.region_id = %(region)s AND h.name <> h.id
  AND NOT EXISTS (SELECT 1 FROM facts f WHERE f.subject_type = 'hotel'
      AND f.subject_id = h.id AND f.characteristic_key = k.key AND f.status <> 'superseded')
  AND NOT EXISTS (SELECT 1 FROM hotelier_questions q
      WHERE q.hotel_id = h.id AND q.characteristic_key = k.key)
ORDER BY h.id, k.key"""

ADD_QUESTIONS = """INSERT INTO hotelier_questions
    (id, hotel_id, characteristic_key, text, reason, status, created_at)
SELECT * FROM unnest(%(ids)s::text[], %(hotels)s::text[], %(keys)s::text[], %(texts)s::text[],
    %(reasons)s::text[], %(statuses)s::text[], %(created)s::timestamptz[])
ON CONFLICT (id) DO NOTHING"""


class PostgresQuestionStore:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def for_hotel(self, hotel_id: str) -> Sequence[QuestionRecord]:
        cursor = await self._connection.execute(HOTEL_QUESTIONS, {"hotel": hotel_id})
        return [_question(row) for row in await cursor.fetchall()]

    async def get(self, question_id: str, lock: bool = False) -> QuestionRecord | None:
        cursor = await self._connection.execute(
            GET_QUESTION + (" FOR UPDATE" if lock else ""), {"id": question_id}
        )
        row = await cursor.fetchone()
        return _question(row) if row else None

    async def record_answer(
        self, question_id: str, status: str, answer_text: str, answered_at: datetime
    ) -> None:
        await self._connection.execute(
            RECORD_ANSWER,
            {"id": question_id, "status": status, "answer": answer_text, "at": answered_at},
        )

    async def set_status(self, question_id: str, status: str) -> None:
        await self._connection.execute(SET_STATUS, {"id": question_id, "status": status})

    async def candidates(
        self, region: str, characteristic_keys: Sequence[str]
    ) -> Sequence[QuestionCandidate]:
        cursor = await self._connection.execute(
            CANDIDATES, {"region": region, "keys": list(characteristic_keys)}
        )
        return [
            QuestionCandidate(
                hotel_id=str(row[0]), hotel_name=str(row[1]), characteristic_key=str(row[2])
            )
            for row in await cursor.fetchall()
        ]

    async def add(self, records: Sequence[QuestionRecord]) -> int:
        if not records:
            return 0
        cursor = await self._connection.execute(
            ADD_QUESTIONS,
            {
                "ids": [record.id for record in records],
                "hotels": [record.hotel_id for record in records],
                "keys": [record.characteristic_key for record in records],
                "texts": [record.text for record in records],
                "reasons": [record.reason for record in records],
                "statuses": [record.status for record in records],
                "created": [record.created_at for record in records],
            },
        )
        return cursor.rowcount


def _question(row: tuple[object, ...]) -> QuestionRecord:
    assert isinstance(row[6], datetime)
    assert row[8] is None or isinstance(row[8], datetime)
    assert isinstance(row[9], list)
    return QuestionRecord(
        id=str(row[0]),
        hotel_id=str(row[1]),
        characteristic_key=str(row[2]),
        text=str(row[3]),
        reason=str(row[4]),
        status=str(row[5]),
        created_at=row[6],
        answer_text=str(row[7]) if row[7] is not None else None,
        answered_at=row[8],
        answer_fact_ids=tuple(str(item) for item in row[9]),
    )
