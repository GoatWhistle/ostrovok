import json
from argparse import ArgumentParser
from pathlib import Path

from hotel_agent.adapters.osm.polygon_extract import prepare_polygon_extract


def main() -> None:
    parser = ArgumentParser(
        description="Prepare buildings and beaches with all referenced OSM nodes"
    )
    parser.add_argument("--pbf", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.pbf.is_file() or not args.pbf.with_name(args.pbf.name + ".ok").is_file():
        parser.error("A verified PBF and its .ok marker are required")
    count = prepare_polygon_extract(args.pbf, args.out)
    report = {"source": str(args.pbf), "target": str(args.out), "selected_objects": count}
    args.out.with_name(args.out.name + ".source.json").write_text(json.dumps(report) + "\n")
    args.out.with_name(args.out.name + ".ok").touch()
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
