import asyncio
import json
import os
import shutil
import subprocess
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.hotel_catalog import PostgresHotelCatalog
from hotel_agent.application.ports.hotel_catalog import (
    CatalogHotel,
    CatalogMappingConflict,
    CatalogRoom,
)


@pytest.fixture
async def catalog_pool() -> AsyncIterator[
    AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]]
]:
    binary = os.environ.get("DBMATE_BIN") or shutil.which("dbmate")
    if binary is None:
        raise RuntimeError("dbmate is required; install it or set DBMATE_BIN")
    source_url = os.environ.get("TEST_DATABASE_URL") or os.environ.get(
        "DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel"
    )
    parts = urlsplit(source_url)
    if parts.scheme not in ("postgres", "postgresql"):
        raise RuntimeError("TEST_DATABASE_URL must be a PostgreSQL URL")
    database = "catalog_test_" + uuid4().hex
    query = dict(parse_qsl(parts.query))
    query.setdefault("sslmode", "disable")
    target_url = urlunsplit((parts.scheme, parts.netloc, "/" + database, urlencode(query), ""))
    admin = await psycopg.AsyncConnection.connect(source_url, autocommit=True, connect_timeout=3)
    try:
        await admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
        try:
            migrations = Path(__file__).resolve().parents[4] / "migrations/postgres"
            result = await asyncio.to_thread(
                subprocess.run,
                [binary, "-d", str(migrations), "--no-dump-schema", "up"],
                env={**os.environ, "DATABASE_URL": target_url},
                capture_output=True,
                text=True,
            )
            if result.returncode:
                raise RuntimeError("dbmate failed for isolated catalog database: " + result.stderr)
            async with AsyncConnectionPool(target_url, min_size=1, max_size=2, open=False) as pool:
                async with pool.connection() as connection:
                    await connection.execute(
                        "INSERT INTO regions(id,name,bbox,built_at) VALUES ('test','test',ST_MakeEnvelope(39,43,40,44,4326),now())"
                    )
                    await connection.execute(
                        "INSERT INTO hotels(id,region_id,name,location) VALUES ('local-1','test','Hotel One',ST_SetSRID(ST_MakePoint(39.72,43.58),4326)), ('local-2','test','Hotel Two',ST_SetSRID(ST_MakePoint(39.73,43.58),4326))"
                    )
                yield pool
        finally:
            await admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(database)))
    finally:
        await admin.close()


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
