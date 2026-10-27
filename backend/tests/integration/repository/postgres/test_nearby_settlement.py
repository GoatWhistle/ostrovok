import psycopg
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.search import PostgresSearchRepository

HOTEL = (39.72, 43.58)
RADIUS_M = 25_000


async def test_nearby_city_prefers_a_town_over_a_closer_hamlet(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    async with catalog_pool.connection() as connection:
        await connection.execute(
            """INSERT INTO pois(id,region_id,location,tags) VALUES
            ('n1','test',ST_SetSRID(ST_MakePoint(39.7205,43.5805),4326),
             '{"place":"hamlet","name":"Выселки"}'::jsonb),
            ('n2','test',ST_SetSRID(ST_MakePoint(39.73,43.59),4326),
             '{"place":"town","name":"Кабардинка"}'::jsonb)"""
        )
        repository = PostgresSearchRepository(connection)

        assert await repository.nearby_city(HOTEL, RADIUS_M) == "Кабардинка"

        await connection.execute("DELETE FROM pois WHERE id = 'n2'")
        assert await repository.nearby_city(HOTEL, RADIUS_M) == "Выселки"

        await connection.execute("DELETE FROM pois WHERE id = 'n1'")
        await connection.execute(
            """UPDATE hotels SET tags = '{"addr:city":"Сочи"}'::jsonb WHERE id = 'local-2'"""
        )
        assert await repository.nearby_city(HOTEL, RADIUS_M) == "Сочи"
        await connection.rollback()


async def test_nearby_city_ignores_settlements_beyond_the_radius(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    async with catalog_pool.connection() as connection:
        await connection.execute(
            """INSERT INTO pois(id,region_id,location,tags) VALUES
            ('n3','test',ST_SetSRID(ST_MakePoint(39.72,43.9),4326),
             '{"place":"city","name":"Далеко"}'::jsonb)"""
        )
        repository = PostgresSearchRepository(connection)
        assert await repository.nearby_city(HOTEL, 5_000) is None
        assert await repository.nearby_city(HOTEL, 50_000) == "Далеко"
        await connection.rollback()
