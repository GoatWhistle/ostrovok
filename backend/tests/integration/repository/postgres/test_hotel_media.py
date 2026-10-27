import psycopg
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.search import PostgresSearchRepository
from hotel_agent.interfaces.http.hotel_identity_schemas import hotel_summary_schema


async def test_persisted_photos_reach_search_and_detail_without_offers(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    async with catalog_pool.connection() as db:
        await db.execute(
            "INSERT INTO hotel_supplier_content(hotel_id,supplier,details) VALUES (%s,%s,%s)",
            (
                "local-1",
                "official",
                Jsonb(
                    {
                        "source_url": "https://hotel.example/gallery",
                        "photos": ["https://hotel.example/photo.jpg"],
                    }
                ),
            ),
        )
        repo = PostgresSearchRepository(db)
        hotels = await repo.list_hotels("test", None)
        hotel = await repo.get_hotel("local-1")
        assert hotel is not None
        assert hotels[0].photos == hotel.photos
        summary = hotel_summary_schema(hotel)
        assert summary.thumbnail_url == "https://hotel.example/photo.jpg"
        assert summary.photos[0].source_url == "https://hotel.example/gallery"
        empty = await repo.get_hotel("local-2")
        assert empty is not None
        assert hotel_summary_schema(empty).thumbnail_url is None
        assert hotel_summary_schema(empty).photos == []
