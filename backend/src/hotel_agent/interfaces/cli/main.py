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

    ingest = commands.add_parser("ingest", help="Load a prepared region slice into PostGIS")
    ingest.add_argument("--region", default="sochi")
    ingest.add_argument("--from", dest="directory", required=True)

    pbf = commands.add_parser("ingest-pbf", help="Stream OSM PBF layers into PostGIS")
    pbf.add_argument("--region", default="russia")
    pbf.add_argument("--bbox", default="-180,41,180,82")
    pbf.add_argument("--pbf", required=True)
    pbf.add_argument("--layers", nargs="+", default=["hotels", "pois"])
    pbf.add_argument("--batch-size", type=int, default=5_000)
    pbf.add_argument("--min-free-gib", type=float, default=6.0)
    pbf.add_argument("--building-radius-m", type=float, default=0.0)
    pbf.add_argument("--workers", type=int, default=1)

    settlements = commands.add_parser(
        "ingest-settlements", help="Load named settlements from an OSM PBF into PostGIS"
    )
    settlements.add_argument("--region", default="russia")
    settlements.add_argument("--pbf", required=True)
    settlements.add_argument("--batch-size", type=int, default=5_000)

    precompute = commands.add_parser("precompute", help="Compute facts from loaded region data")
    precompute.add_argument("--region", default="sochi")
    precompute.add_argument("--from", dest="directory", required=True)

    geometry = commands.add_parser(
        "refresh-geography", help="Refresh facades and explicit OSM heights"
    )
    geometry.add_argument("--region", default="russia")

    questions = commands.add_parser(
        "plan-questions", help="Queue hotelier questions the searches actually ask for"
    )
    questions.add_argument("--region", default="sochi")
    questions.add_argument("--limit", type=int, default=200)
    questions.add_argument(
        "--cold-start",
        type=int,
        default=20,
        help="How many questions to queue when no search demand is recorded yet",
    )

    notices = commands.add_parser(
        "notify-hoteliers", help="Raise notifications about expiring values and blocked searches"
    )
    notices.add_argument("--region", default="sochi")
    notices.add_argument("--lead-days", type=int, default=14)
    notices.add_argument("--window-days", type=int, default=14)
    notices.add_argument("--limit", type=int, default=500)

    refresh = commands.add_parser(
        "refresh-facts", help="Recheck facts whose validity has expired and record disagreements"
    )
    refresh.add_argument("--region", default="sochi")
    refresh.add_argument("--from", dest="directory", default="data/seed/sochi")
    refresh.add_argument("--limit", type=int, default=500)

    metrics = commands.add_parser(
        "metrics", help="Report characteristic coverage and the share answered by hoteliers"
    )
    metrics.add_argument("--region", default="sochi")

    catalog = commands.add_parser("sync-nuitee", help="Import a verified hotel and its room types")
    catalog.add_argument("--hotel-id", required=True)
    catalog.add_argument("--supplier-id", required=True)
    matching = commands.add_parser(
        "match-nuitee", help="Match one hotel by name, address and coordinates"
    )
    matching.add_argument("--hotel-id", required=True)
    matching.add_argument(
        "--apply", action="store_true", help="Import only a unique verified match"
    )
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
