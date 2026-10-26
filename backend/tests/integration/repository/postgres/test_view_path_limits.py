import os

import psycopg
import pytest

from hotel_agent.adapters.db import view_scenes


@pytest.mark.parametrize("limit", [1, 3, 5])
async def test_only_unfinished_paths_are_truncated(
    monkeypatch: pytest.MonkeyPatch, limit: int
) -> None:
    monkeypatch.setattr(view_scenes, "BUILDINGS_PER_PATH", limit)
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        for index, lat in enumerate((0.0, 0.01, 0.01, 0.01, 0.01, 0.02)):
            await connection.execute(
                """INSERT INTO buildings(id,region_id,footprint,tags,height_m,levels)
                VALUES (%s,'sochi',ST_MakeEnvelope(0.009,%s-0.0001,0.011,%s+0.0001,4326),
                '{"building":"yes","height":"20"}',20,5)""",
                (f"path-limit-{index}", lat, lat),
            )
        result = await view_scenes.PostgresViewScenes(connection).path_buildings(
            {
                key: ((0.0, lat), (0.02, lat))
                for key, lat in (("a", 0.0), ("b", 0.01), ("c", 0.02), ("d", 0.03))
            }
        )
        assert result.truncated is (limit < 4)
        assert result.complete_paths == (
            frozenset({"a", "c", "d"}) if limit < 4 else frozenset({"a", "b", "c", "d"})
        )
        assert len(result.buildings["a"]) == 1
        assert len(result.buildings["b"]) == min(limit, 4)
        assert len(result.buildings["c"]) == 1
        assert result.buildings["d"] == ()
    finally:
        await connection.rollback()
        await connection.close()
