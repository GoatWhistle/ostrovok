import argparse
import asyncio
import os
from pathlib import Path

from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.semantic.batch_index import build_batches
from hotel_agent.adapters.semantic.polza import PolzaEmbeddings
from hotel_agent.settings import load_settings


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=Path("../data/raw/semantic"))
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    env = dict(os.environ)
    if args.env_file:
        for line in args.env_file.read_text().splitlines():
            if line.startswith("EMBEDDING_") and "=" in line:
                key, value = line.split("=", 1)
                env[key] = value.strip().strip("\"'")
    settings = load_settings(env)
    if not settings.embedding_api_key:
        raise SystemExit("EMBEDDING_API_KEY is required")
    uow_factory = PostgresUnitOfWorkFactory(settings.database_url)
    embedder = PolzaEmbeddings(
        settings.embedding_api_key, settings.embedding_model, settings.embedding_base_url
    )
    try:
        async with uow_factory() as uow:
            documents = await uow.documents.list()
        print(
            f"source_documents={len(documents)} hotels={len({d.hotel_id for d in documents})}",
            flush=True,
        )
        count = await build_batches(
            documents,
            args.directory,
            embedder,
            settings.embedding_model,
            args.batch_size,
            args.concurrency,
            progress=lambda message: print(message, flush=True),
        )
        print(f"indexed_chunks={count}", flush=True)
    finally:
        await embedder.aclose()
        await uow_factory.aclose()


if __name__ == "__main__":
    asyncio.run(main())
