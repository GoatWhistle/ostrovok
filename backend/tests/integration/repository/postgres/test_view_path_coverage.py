import os

import psycopg
import pytest

from hotel_agent.adapters.db.view_scenes import PostgresViewScenes


@pytest.mark.parametrize(
    "gap_y,complete,expired,covered",
    [
        (0.002, True, False, True),
        (0, True, False, False),
        (0.002, False, False, False),
        (0.002, True, True, False),
    ],
)
async def test_coverage_checks_actual_corridor_and_preserves_source_gaps(
    gap_y: float, complete: bool, expired: bool, covered: bool
) -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute(
            """INSERT INTO geography_coverage
            (id,bbox,source_url,fetched_at,valid_until,complete,counts)
            VALUES ('view-corridor-coverage-test',
              ST_Difference(ST_MakeEnvelope(-0.01,-0.01,0.03,0.01,4326),
                ST_MakeEnvelope(0.009,%s-0.0001,0.011,%s+0.0001,4326)),
              'https://example.org/verified-extract',now()-interval '2 days',
              now()+make_interval(days=>%s),%s,'{}')""",
            (gap_y, gap_y, -1 if expired else 1, complete),
        )
        result = await PostgresViewScenes(connection).path_buildings(
            {"ray": ((0.0, 0.0), (0.02, 0.0))}
        )
        assert bool(result.coverage_sources.get("ray")) is covered
        if covered:
            assert result.coverage_sources["ray"] == "https://example.org/verified-extract"
    finally:
        await connection.rollback()
        await connection.close()
