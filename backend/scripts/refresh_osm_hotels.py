import asyncio
from argparse import ArgumentParser
from pathlib import Path

from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.osm.hotel_tags import iter_hotel_tags
from hotel_agent.application.use_cases.refresh_hotel_tags import RefreshHotelTags
from hotel_agent.settings import DEFAULT_DATABASE_URL


async def main() -> None:
    parser = ArgumentParser(description="Merge every raw OSM tag into existing hotel records")
    parser.add_argument("--pbf", type=Path, required=True)
    parser.add_argument("--database-url", default=DEFAULT_DATABASE_URL)
    args = parser.parse_args()
    if not args.pbf.is_file() or not args.pbf.with_name(args.pbf.name + ".ok").is_file():
        parser.error("A verified PBF and its .ok marker are required")
    uow = PostgresUnitOfWorkFactory(args.database_url)
    try:
        count = await RefreshHotelTags(uow)(iter_hotel_tags(args.pbf))
        print(f"updated_hotels={count}", flush=True)
    finally:
        await uow.aclose()


if __name__ == "__main__":
    asyncio.run(main())
