import asyncio
import json
import os
import shutil
import sys
from argparse import Namespace
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.facades import PostgresFacadeStore
from hotel_agent.adapters.db.hotel_catalog import PostgresHotelCatalog
from hotel_agent.adapters.db.precompute import PostgresPrecompute
from hotel_agent.adapters.db.seed import PostgresSeedWriter
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.db.walk import PostgresWalkStore
from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog
from hotel_agent.adapters.external.nuitee_discovery import NuiteeDiscovery
from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.dem_rasterio import CopernicusElevationSource
from hotel_agent.adapters.geo.facades import FootprintFacadeExtractor
from hotel_agent.adapters.geo.view_assessment import NearbyViewAssessment
from hotel_agent.adapters.geo.walk_graph import SochiWalkGraph
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.osm.hotel_proximity import HotelProximity
from hotel_agent.adapters.osm.pbf_reader import PbfRegionSource
from hotel_agent.adapters.osm.pbf_stream import iter_region_batches
from hotel_agent.adapters.osm.settlements import iter_settlement_batches
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.adapters.seed.reader import GeoJsonSeedReader
from hotel_agent.adapters.seed.store import GeoJsonSeedStore
from hotel_agent.application.use_cases.build_seed import BuildSeed
from hotel_agent.application.use_cases.hotelier_questions import PlanHotelierQuestions
from hotel_agent.application.use_cases.ingest_pbf import IngestPbf
from hotel_agent.application.use_cases.ingest_polygons import IngestPolygons
from hotel_agent.application.use_cases.ingest_seed import IngestSeed
from hotel_agent.application.use_cases.match_hotel_catalog import MatchHotelCatalog
from hotel_agent.application.use_cases.precompute import Precompute
from hotel_agent.application.use_cases.precompute_facades import PrecomputeFacades
from hotel_agent.application.use_cases.precompute_sunset import PrecomputeSunset
from hotel_agent.application.use_cases.precompute_walk import PrecomputeWalk
from hotel_agent.application.use_cases.refresh_hotel_heights import RefreshHotelHeights
from hotel_agent.application.use_cases.sync_hotel_catalog import SyncHotelCatalog
from hotel_agent.interfaces.cli.main import build_parser, parse_bbox, run_build_seed
from hotel_agent.settings import HotelDataMode, Settings, load_settings


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    settings = load_settings(os.environ)
    if (
        args.command in {"sync-nuitee", "match-nuitee"}
        and settings.hotel_data_mode is HotelDataMode.FREE
    ):
        raise SystemExit(
            "HOTEL_DATA_MODE=free disables commercial hotel APIs; use OSM and public hotel websites"
        )
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
    if args.command == "ingest-settlements":
        return asyncio.run(_ingest_settlements(args, settings.database_url))
    if args.command == "precompute":
        code = asyncio.run(_precompute(args.region, Path(args.directory), settings.database_url))
        return code or asyncio.run(_plan_questions(args.region, settings))
    if args.command == "plan-questions":
        return asyncio.run(_plan_questions(args.region, settings))
    if args.command == "refresh-geography":
        return asyncio.run(_refresh_geography(args.region, settings.database_url))
    if args.command == "sync-nuitee":
        if not settings.nuitee_api_key:
            raise SystemExit("NUITEE_API_KEY is required for sync-nuitee")
        return asyncio.run(
            _sync_nuitee(
                args.hotel_id, args.supplier_id, settings.database_url, settings.nuitee_api_key
            )
        )
    if args.command == "match-nuitee":
        if not settings.nuitee_api_key:
            raise SystemExit("NUITEE_API_KEY is required for match-nuitee")
        return asyncio.run(_match_nuitee(args, settings.database_url, settings.nuitee_api_key))
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
    if args.building_radius_m < 0:
        raise SystemExit("building-radius-m must not be negative")
    if not 1 <= args.workers <= 4 or (args.workers > 1 and selected - {"buildings", "beaches"}):
        raise SystemExit("workers must be 1–4; parallel import supports only buildings/beaches")
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
    async with AsyncConnectionPool(
        database_url,
        min_size=1,
        max_size=max(2, args.workers),
        open=False,
        kwargs={"application_name": "geography-import"},
    ) as pool:
        building_nearby = None
        if "buildings" in selected and args.building_radius_m > 0:
            async with pool.connection() as connection:
                cursor = await connection.execute(
                    "SELECT ST_X(location), ST_Y(location) FROM hotels WHERE region_id = %s",
                    (args.region,),
                )
                locations = await cursor.fetchall()
            if not locations:
                raise SystemExit(f"No hotels in region {args.region}; import hotels first")
            building_nearby = HotelProximity(locations, args.building_radius_m)
        with TemporaryDirectory(prefix="osm-nodes-", dir=path.parent) as cache:
            batches = iter_region_batches(
                path,
                bbox,
                logger,
                selected,
                args.batch_size,
                building_nearby,
                f"sparse_file_array,{Path(cache) / 'nodes.idx'}",
            )
            if args.workers > 1:
                report = await IngestPolygons(lambda: PostgresSeedWriter(pool), args.workers)(
                    args.region, meta, batches, selected, check_capacity, on_batch
                )
            else:
                async with PostgresSeedWriter(pool) as writer:
                    report = await IngestPbf(writer)(
                        args.region, meta, batches, selected, check_capacity, on_batch
                    )
    print(f"region={report.region} batches={report.batches} counts={dict(report.counts)}")
    return 0


async def _ingest_settlements(args: Namespace, database_url: str) -> int:
    path = Path(args.pbf)
    if not path.is_file() or not path.with_name(path.name + ".ok").is_file():
        raise SystemExit(f"Verified PBF and .ok marker are required: {path}")
    if args.batch_size <= 0:
        raise SystemExit("batch-size must be positive")

    def on_batch(number: int, counts: Mapping[str, int]) -> None:
        if number % 10 == 0:
            print(f"batches={number} counts={counts}", flush=True)

    async with AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool:
        async with pool.connection() as connection:
            row = await (
                await connection.execute(
                    "SELECT ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox), built_at"
                    " FROM regions WHERE id = %s",
                    (args.region,),
                )
            ).fetchone()
        if row is None:
            raise SystemExit(f"Region {args.region} is not imported yet")
        meta: dict[str, object] = {
            "bbox": [float(str(value)) for value in row[:4]],
            "built_at": str(row[4]),
        }
        async with PostgresSeedWriter(pool) as writer:
            report = await IngestPbf(writer)(
                args.region,
                meta,
                iter_settlement_batches(path, args.batch_size),
                frozenset({"pois"}),
                lambda: None,
                on_batch,
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
    uow = PostgresUnitOfWorkFactory(database_url)
    try:
        terrain = CountryTerrainTiles(directory / "dem.tif", None)
        sunset = await PrecomputeSunset(uow, NearbyViewAssessment(terrain, uow), SystemClock())(
            region
        )
    finally:
        await uow.aclose()
    for name, count in counts.items():
        print(f"{name}: {count}")
    print(f"distance_to_sea: {routes}")
    for name, count in facades.items():
        print(f"{name}: {count}")
    print(f"sunset_view: {sunset}")
    return 0


async def _refresh_geography(region: str, database_url: str) -> int:
    uow = PostgresUnitOfWorkFactory(database_url)
    try:
        heights = await RefreshHotelHeights(uow, SystemClock())(region)
        facades = await PrecomputeFacades(
            FootprintFacadeExtractor(), PostgresFacadeStore(uow.pool)
        )(region, compute_noise=False)
        print(json.dumps(dict(heights) | dict(facades)))
        return 0
    finally:
        await uow.aclose()


async def _plan_questions(region: str, settings: Settings) -> int:
    uow = PostgresUnitOfWorkFactory(settings.database_url, settings.seed_dir)
    try:
        added = await PlanHotelierQuestions(
            uow,
            YamlCharacteristicRegistry.from_directory(settings.characteristics_dir),
            SystemClock(),
        )(region)
    finally:
        await uow.aclose()
    print(f"hotelier_questions: {added}")
    return 0


async def _sync_nuitee(hotel_id: str, supplier_id: str, database_url: str, api_key: str) -> int:
    async with AsyncConnectionPool(database_url, min_size=1, max_size=2, open=False) as pool:
        count = await SyncHotelCatalog(NuiteeCatalog(api_key), PostgresHotelCatalog(pool))(
            hotel_id, supplier_id
        )
    print(f"Imported {count} room categories for hotel {hotel_id}")
    return 0


async def _match_nuitee(args: Namespace, database_url: str, api_key: str) -> int:
    uow = PostgresUnitOfWorkFactory(database_url)
    try:
        result = await MatchHotelCatalog(
            uow, NuiteeDiscovery(api_key), NuiteeCatalog(api_key), PostgresHotelCatalog(uow.pool)
        )(args.hotel_id, persist=args.apply)
        print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
        return 0 if result.supplier_id is not None else 2
    finally:
        await uow.aclose()


if __name__ == "__main__":
    sys.exit(main())
