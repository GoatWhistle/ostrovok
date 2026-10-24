from argparse import ArgumentParser, Namespace
from collections.abc import Callable

from hotel_agent.application.use_cases.build_seed import BuildSeed, SeedReport
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import BBox

SOCHI = "39.55,43.35,40.00,43.75"


def build_parser() -> ArgumentParser:
    parser = ArgumentParser(prog="hotel-agent", description="Hotel agent data commands")
    commands = parser.add_subparsers(dest="command", required=True)

    seed = commands.add_parser("build-seed", help="Cut a region out of a raw OSM extract and DEM")
    seed.add_argument("--region", default="sochi")
    seed.add_argument("--bbox", default=SOCHI, help="min_lon,min_lat,max_lon,max_lat")
    seed.add_argument("--pbf", required=True)
    seed.add_argument("--dem", nargs="+", required=True)
    seed.add_argument("--out", required=True)
    return parser


def parse_bbox(raw: str) -> BBox:
    parts = raw.split(",")
    if len(parts) != 4:
        raise InvalidValue(f"bbox {raw!r} must read min_lon,min_lat,max_lon,max_lat")
    try:
        values = [float(part) for part in parts]
    except ValueError:
        raise InvalidValue(f"bbox {raw!r} holds a value that is not a number") from None
    return BBox(*values)


def run_build_seed(build: BuildSeed, args: Namespace, out: Callable[[str], None]) -> int:
    report = build(args.region, parse_bbox(args.bbox))
    out(f"region {report.region} bbox {','.join(str(value) for value in report.bbox.as_tuple())}")
    for name, count in report.counts.items():
        out(f"  {name:<14} {count:>8,}  {_mb(report.sizes[name]):>8}")
    out(f"  {'dem.tif':<14} {'':>8}  {_mb(_dem_bytes(report)):>8}")
    out(f"  {'total':<14} {'':>8}  {_mb(report.total_bytes + _dem_bytes(report)):>8}")
    elevation = report.elevation
    out(
        f"  dem {elevation.get('width')}x{elevation.get('height')} {elevation.get('dtype')}"
        f" {elevation.get('min_m')}..{elevation.get('max_m')} m"
    )
    return 0


def _dem_bytes(report: SeedReport) -> int:
    value = report.elevation.get("bytes", 0)
    return value if isinstance(value, int) else 0


def _mb(size: int) -> str:
    return f"{size / 1_048_576:.1f} MB"
