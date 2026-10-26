import os

import psycopg
from psycopg.types.json import Jsonb

from hotel_agent.adapters.db.named_places import PostgresNamedPlaceRepository


async def test_name_variants_reach_review_without_bypassing_type_or_area() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute(
            "CREATE TEMP TABLE pois (id text,location geometry(Point,4326),tags jsonb)"
        )
        for identifier, longitude, tags in (
            ("tower", 37.61, {"name": "Останкинская телевизионная башня", "man_made": "tower"}),
            ("pond", 37.61, {"name": "Останкинский пруд", "natural": "water"}),
            ("remote", 40, {"name": "Останкинская телевизионная башня", "man_made": "tower"}),
        ):
            await connection.execute(
                "INSERT INTO pois VALUES (%s,ST_SetSRID(ST_MakePoint(%s,55.82),4326),%s)",
                (identifier, longitude, Jsonb(tags)),
            )
        repository = PostgresNamedPlaceRepository(connection)
        bounds = (37.5, 55.75, 37.7, 55.9)
        candidates = await repository.candidates("Останкинская телебашня", bounds)
        assert {p.id for p in candidates} == {"tower", "pond"}
        typed = await repository.candidates(
            "Останкинская телебашня", bounds, "man_made", ("tower",)
        )
        assert [p.id for p in typed] == ["tower"]
    finally:
        await connection.rollback()
        await connection.close()
