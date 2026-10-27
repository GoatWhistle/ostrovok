import psycopg

from hotel_agent.adapters.db.map_scene import PostgresMapScene


async def test_whole_footprints_with_holes_come_back_nearest_first(
    disposable_database: str,
) -> None:
    async with await psycopg.AsyncConnection.connect(disposable_database) as connection:
        await connection.execute(
            """INSERT INTO regions(id, name, bbox, built_at)
            VALUES ('scene', 'Scene', ST_MakeEnvelope(39, 43, 40, 44, 4326), now())"""
        )
        await connection.execute(
            """INSERT INTO buildings(id, region_id, footprint, tags, height_m, levels)
            VALUES
            ('scene-ring', 'scene', ST_Multi(ST_GeomFromText(
              'POLYGON((39.5 43.5, 39.502 43.5, 39.502 43.502, 39.5 43.502, 39.5 43.5),
                       (39.5005 43.5005, 39.5015 43.5005, 39.5015 43.5015, 39.5005 43.5015, 39.5005 43.5005))',
              4326)), '{"min_height":"3"}', 20, 6),
            ('scene-far', 'scene', ST_Multi(ST_MakeEnvelope(39.5085, 43.5, 39.5095, 43.501, 4326)),
              '{}', NULL, NULL),
            ('scene-outside', 'scene', ST_Multi(ST_MakeEnvelope(39.6, 43.6, 39.601, 43.601, 4326)),
              '{}', NULL, NULL)"""
        )
        found = await PostgresMapScene(connection).candidates(
            "scene", (39.4995, 43.4995, 39.509, 43.5025), 10
        )
        await connection.rollback()
    assert found.eligible == 2
    assert [item.id for item in found.buildings] == ["scene-ring", "scene-far"]
    ring = found.buildings[0]
    assert ring.geometry["type"] == "MultiPolygon"
    assert len(ring.geometry["coordinates"][0]) == 2
    assert ring.min_height_m == 3.0
    assert ring.height_m == 20.0
    assert ring.points == 10
