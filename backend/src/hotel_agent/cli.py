import asyncio
import os
import shutil
import sys
from argparse import Namespace
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.facades import PostgresFacadeStore
from hotel_agent.adapters.db.hotel_catalog import PostgresHotelCatalog
from hotel_agent.adapters.db.precompute import PostgresPrecompute
from hotel_agent.adapters.db.seed import PostgresSeedWriter
from hotel_agent.adapters.db.walk import PostgresWalkStore
from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog
from hotel_agent.adapters.geo.dem_rasterio import CopernicusElevationSource
from hotel_agent.adapters.geo.facades import FootprintFacadeExtractor
from hotel_agent.adapters.geo.walk_graph import SochiWalkGraph
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.osm.pbf_reader import PbfRegionSource, iter_region_batches
from hotel_agent.adapters.seed.reader import GeoJsonSeedReader
from hotel_agent.adapters.seed.store import GeoJsonSeedStore
from hotel_agent.application.use_cases.build_seed import BuildSeed
from hotel_agent.application.use_cases.ingest_pbf import IngestPbf
from hotel_agent.application.use_cases.ingest_seed import IngestSeed
from hotel_agent.application.use_cases.precompute import Precompute
from hotel_agent.application.use_cases.precompute_facades import PrecomputeFacades
from hotel_agent.application.use_cases.precompute_walk import PrecomputeWalk
from hotel_agent.application.use_cases.sync_hotel_catalog import SyncHotelCatalog
from hotel_agent.interfaces.cli.main import build_parser, parse_bbox, run_build_seed
from hotel_agent.settings import load_settings


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    settings = load_settings(os.environ)
    logger = StdlibLogger("hotel_agent.cli")
    if args.command == "build-seed":
        out = Path(args.out)
        build = BuildSeed(
            source=PbfRegionSource(Path(args.pbf), logger),
            store=GeoJsonSeedStore(out),
            elevation=CopernicusElevationSource([Path(tile) for tile in args.dem], out / "dem.tif"),
            clock=SystemClock(),
            logger=logger,
        )
        return run_build_seed(build, args, print)
    if args.command == "ingest":
        return asyncio.run(_ingest(args.region, Path(args.directory), settings.database_url))
    if args.command == "ingest-pbf":
        return asyncio.run(_ingest_pbf(args, settings.database_url, logger))
    if args.command == "precompute":
        return asyncio.run(_precompute(args.region, Path(args.directory), settings.database_url))
    if args.command == "sync-nuitee":
        if not settings.nuitee_api_key:
            raise SystemExit("NUITEE_API_KEY is required for sync-nuitee")
        return asyncio.run(
            _sync_nuitee(
                args.hotel_id, args.supplier_id, settings.database_url, settings.nuitee_api_key
            )
        )
    return 1


async def _ingest(region: str, directory: Path, database_url: str) -> int:
    async with (
        AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool,
        PostgresSeedWriter(pool) as writer,
    ):
        report = await IngestSeed(GeoJsonSeedReader(), writer)(region, directory)
    for name, count in report.counts.items():
        print(f"{name}: {count}")
    print(f"hotels with footprint: {report.hotels_with_footprint}")
    return 0


async def _ingest_pbf(args: Namespace, database_url: str, logger: StdlibLogger) -> int:
    path = Path(args.pbf)
    if not path.is_file() or not path.with_name(path.name + ".ok").is_file():
        raise SystemExit(f"Verified PBF and .ok marker are required: {path}")
    selected = frozenset(args.layers)
    valid = frozenset(
        ("buildings", "hotels", "pois", "coastline", "beaches", "noise_sources", "walk")
    )
    if not selected or selected - valid:
        raise SystemExit(f"Invalid layers: {sorted(selected - valid)}")
    if args.min_free_gib < 1:
        raise SystemExit("min-free-gib must be at least 1")
    bbox = parse_bbox(args.bbox)
    minimum = int(args.min_free_gib * 1024**3)

    def check_capacity() -> None:
        free = shutil.disk_usage(path.parent).free
        if free < minimum:
            raise RuntimeError(f"Import stopped with {free / 1024**3:.1f} GiB free")

    def on_batch(number: int, counts: Mapping[str, int]) -> None:
        if number % 20 == 0:
            print(f"batches={number} counts={counts}", flush=True)

    meta: dict[str, object] = {
        "bbox": list(bbox.as_tuple()),
        "built_at": datetime.now(UTC).isoformat(),
    }
    check_capacity()
    async with (
        AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool,
        PostgresSeedWriter(pool) as writer,
    ):
        batches = iter_region_batches(path, bbox, logger, selected, args.batch_size)
        report = await IngestPbf(writer)(
            args.region, meta, batches, selected, check_capacity, on_batch
        )
    print(f"region={report.region} batches={report.batches} counts={dict(report.counts)}")
    return 0


async def _precompute(region: str, directory: Path, database_url: str) -> int:
    async with AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool:
        counts = await Precompute(PostgresPrecompute(pool))(region)
        routes = await PrecomputeWalk(SochiWalkGraph(), PostgresWalkStore(pool))(region, directory)
        facades = await PrecomputeFacades(FootprintFacadeExtractor(), PostgresFacadeStore(pool))(
            region
        )
    for name, count in counts.items():
        print(f"{name}: {count}")
    print(f"distance_to_sea: {routes}")
    for name, count in facades.items():
        print(f"{name}: {count}")
    return 0


async def _sync_nuitee(hotel_id: str, supplier_id: str, database_url: str, api_key: str) -> int:
    async with AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool:
        count = await SyncHotelCatalog(NuiteeCatalog(api_key), PostgresHotelCatalog(pool))(
            hotel_id, supplier_id
        )
    print(f"Imported {count} room categories for hotel {hotel_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
