import asyncio
import os
import shutil
import subprocess
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg_pool import AsyncConnectionPool

MIGRATIONS = Path(__file__).resolve().parents[4] / "migrations" / "postgres"


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


@pytest.fixture(scope="session")
def disposable_database() -> Iterator[str]:
    base = os.environ.get("TEST_DATABASE_URL") or os.environ.get(
        "DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel"
    )
    dbmate = os.environ.get("DBMATE_BIN") or shutil.which("dbmate")
    if dbmate is None:
        pytest.fail(
            "dbmate binary is required for disposable databases; install it or set DBMATE_BIN"
        )
    name = f"hotel_it_{uuid4().hex[:12]}"
    url = urlunsplit(urlsplit(base)._replace(path=f"/{name}"))
    with psycopg.connect(base, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    try:
        subprocess.run(
            [
                dbmate,
                "--url",
                f"{url}?sslmode=disable",
                "--migrations-dir",
                str(MIGRATIONS),
                "--no-dump-schema",
                "up",
                "--strict",
            ],
            check=True,
            capture_output=True,
        )
        yield url
    finally:
        with psycopg.connect(base, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name))
            )
