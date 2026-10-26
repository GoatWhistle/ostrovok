import math
import os

import psycopg

from hotel_agent.adapters.db.map_tiles import PostgresMapTileRepository


async def test_imported_layers_and_provenance_are_encoded_in_adler_tile() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        z = 16
        x = int((39.904065 + 180) / 360 * 2**z)
        y = int((1 - math.asinh(math.tan(math.radians(43.4451502))) / math.pi) / 2 * 2**z)
        payload = await PostgresMapTileRepository(connection).get(z, x, y)
        for field in (
            b"buildings",
            b"landcover",
            b"water",
            b"trees",
            b"class_source",
            b"height_source",
        ):
            assert field in payload
        result = await connection.execute(
            "SELECT count(*) FROM buildings WHERE class_source='hotel' AND class='hotel'"
        )
        row = await result.fetchone()
        assert row and row[0] > 0
    finally:
        await connection.close()
