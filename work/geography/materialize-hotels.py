import asyncio
import json
from pathlib import Path

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.facades import PostgresFacadeStore
from hotel_agent.adapters.db.seed import PostgresSeedWriter
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.geo.facades import FootprintFacadeExtractor
from hotel_agent.application.use_cases.refresh_hotel_heights import RefreshHotelHeights

ROOT = Path(__file__).resolve().parents[2]


async def main() -> None:
    uow = PostgresUnitOfWorkFactory("postgresql://hotel:hotel@localhost:5432/hotel")
    try:
        async with uow() as unit:
            await unit.regions.list_loaded()
        async with PostgresSeedWriter(uow.pool) as writer:
            linked = await writer.link_hotels("russia")
            await writer.commit()
        async with uow() as unit:
            hotels = await unit.search.list_hotels("russia", None)
            buildings = await unit.view_scenes.hotel_buildings([hotel.id for hotel in hotels])
        store = PostgresFacadeStore(uow.pool)
        extractor = FootprintFacadeExtractor()
        facades = [
            facade
            for footprint in await store.footprints("russia")
            for facade in extractor.extract(footprint)
        ]
        count = await store.save("russia", facades)
        heights = {}
        for region in ("russia", "sochi"):
            heights[region] = dict(await RefreshHotelHeights(uow, SystemClock())(region))
        report = {
            "facades": count,
            "height_refresh": heights,
            "named_hotels": len(hotels),
            "linked_named_hotels": len(buildings),
            "linked_hotels_total": linked,
        }
        (ROOT / "work/geography/materialization.json").write_text(
            json.dumps(report, indent=2) + "\n"
        )
        print(json.dumps(report), flush=True)
    finally:
        await uow.aclose()


if __name__ == "__main__":
    asyncio.run(main())
