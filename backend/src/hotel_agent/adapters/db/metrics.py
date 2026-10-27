from collections.abc import Sequence

from psycopg import AsyncConnection

from hotel_agent.application.quality_metrics import CharacteristicMetric

COVERAGE = """WITH scope AS (SELECT id FROM hotels WHERE region_id = %(region)s),
counted AS (
    SELECT f.characteristic_key AS key, COUNT(DISTINCT f.subject_id) AS covered
    FROM facts f JOIN scope s ON s.id = f.subject_id
    WHERE f.subject_type = 'hotel' AND f.status IN ('active', 'confirmed_by_hotelier')
    GROUP BY 1),
asked AS (
    SELECT q.characteristic_key AS key, COUNT(DISTINCT q.hotel_id) AS open_questions
    FROM hotelier_questions q JOIN scope s ON s.id = q.hotel_id
    WHERE q.status = 'open'
    GROUP BY 1),
answered AS (
    SELECT f.characteristic_key AS key, COUNT(DISTINCT f.subject_id) AS from_hotelier
    FROM facts f JOIN scope s ON s.id = f.subject_id
    WHERE f.subject_type = 'hotel' AND f.source_type IN ('hotelier', 'llm_extraction')
      AND f.status IN ('active', 'confirmed_by_hotelier')
    GROUP BY 1)
SELECT COALESCE(counted.key, asked.key, answered.key),
    (SELECT COUNT(*) FROM scope),
    COALESCE(counted.covered, 0),
    COALESCE(asked.open_questions, 0),
    COALESCE(answered.from_hotelier, 0)
FROM counted
FULL OUTER JOIN asked ON asked.key = counted.key
FULL OUTER JOIN answered ON answered.key = COALESCE(counted.key, asked.key)
ORDER BY 1"""


class PostgresQualityMetrics:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def coverage(self, region: str) -> Sequence[CharacteristicMetric]:
        result = await self._connection.execute(COVERAGE, {"region": region})
        return [
            CharacteristicMetric(
                characteristic_key=str(row[0]),
                hotels=int(str(row[1])),
                covered=int(str(row[2])),
                open_questions=int(str(row[3])),
                from_hotelier=int(str(row[4])),
            )
            for row in await result.fetchall()
        ]
