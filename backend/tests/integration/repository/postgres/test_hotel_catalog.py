import json

import psycopg
import pytest
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.hotel_catalog import PostgresHotelCatalog
from hotel_agent.application.ports.hotel_catalog import (
    CatalogHotel,
    CatalogMappingConflict,
    CatalogRoom,
)


def catalog(supplier_id: str = "supplier-1") -> CatalogHotel:
    return CatalogHotel(
        supplier_id=supplier_id,
        name="Hotel One",
        facilities_ru=("Бассейн",),
        facilities_en=("Pool",),
        rooms=(
            CatalogRoom(
                supplier_id="room-1", name="Double", max_adults=2, amenities=("Кондиционер",)
            ),
        ),
    )


async def test_catalog_import_is_repeatable_and_visible_to_real_queries(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    store = PostgresHotelCatalog(catalog_pool)
    assert await store.save("local-1", catalog()) == 1
    assert await store.save("local-1", catalog()) == 1
    async with catalog_pool.connection() as connection:
        refs = await connection.execute(
            "SELECT supplier_id FROM hotel_supplier_refs WHERE hotel_id = %s", ("local-1",)
        )
        assert await refs.fetchone() == ("supplier-1",)
        rooms = await connection.execute(
            "SELECT capacity, synthetic, included FROM rooms WHERE hotel_id = %s", ("local-1",)
        )
        assert await rooms.fetchall() == [(2, False, ["Кондиционер"])]
        docs = await connection.execute(
            "SELECT text FROM hotel_search_documents WHERE hotel_id = %s AND id LIKE 'room:%%'",
            ("local-1",),
        )
        document = await docs.fetchone()
        assert document is not None
        assert json.loads(str(document[0]))["capacity"] == 2


async def test_supplier_identity_cannot_be_attached_to_another_local_hotel(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    store = PostgresHotelCatalog(catalog_pool)
    await store.save("local-1", catalog())
    with pytest.raises(CatalogMappingConflict):
        await store.save("local-2", catalog())
    async with catalog_pool.connection() as connection:
        result = await connection.execute(
            "SELECT count(*) FROM hotel_supplier_content WHERE hotel_id = %s", ("local-2",)
        )
        assert await result.fetchone() == (0,)


async def test_verified_local_mapping_cannot_be_replaced(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
) -> None:
    store = PostgresHotelCatalog(catalog_pool)
    await store.save("local-1", catalog())
    with pytest.raises(CatalogMappingConflict):
        await store.save("local-1", catalog("different-id"))
    async with catalog_pool.connection() as connection:
        result = await connection.execute(
            "SELECT supplier_id FROM hotel_supplier_refs WHERE hotel_id = %s", ("local-1",)
        )
        assert await result.fetchone() == ("supplier-1",)
