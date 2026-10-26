import psycopg
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.named_places import PostgresNamedPlaceRepository


async def test_full_name_entity_is_retrieved_alongside_same_named_pavilion(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    async with catalog_pool.connection() as connection:
        for identifier, name, kind, entity in (
            ("w101", "Эрмитаж", "museum", "QOther"),
            ("r102", "Государственный Эрмитаж", "museum", "Q132783"),
            ("w103", "Эрмитаж", "hotel", "QHotel"),
        ):
            await connection.execute(
                "INSERT INTO pois(id,region_id,location,tags) VALUES (%s,'test',ST_SetSRID(ST_MakePoint(39.7,43.5),4326),%s)",
                (identifier, Jsonb({"name": name, "tourism": kind, "wikidata": entity})),
            )
        repository = PostgresNamedPlaceRepository(connection)
        rows = await repository.candidates("Эрмитаж", (39, 43, 40, 44), "tourism", ("museum",))
        assert {row.id for row in rows} == {"w101", "r102"}
        assert {row.tags["wikidata"] for row in rows} == {"QOther", "Q132783"}
        assert (
            await repository.candidates("Эрмитаж", (10, 10, 11, 11), "tourism", ("museum",)) == ()
        )
