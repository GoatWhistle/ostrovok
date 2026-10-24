import os
import sys
from collections.abc import Sequence
from pathlib import Path

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.geo.dem_rasterio import CopernicusElevationSource
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.osm.pbf_reader import PbfRegionSource
from hotel_agent.adapters.seed.store import GeoJsonSeedStore
from hotel_agent.application.use_cases.build_seed import BuildSeed
from hotel_agent.interfaces.cli.main import build_parser, run_build_seed
from hotel_agent.settings import load_settings


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    load_settings(os.environ)
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
    return 1


if __name__ == "__main__":
    sys.exit(main())
