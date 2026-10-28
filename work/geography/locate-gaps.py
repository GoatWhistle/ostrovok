import hashlib
import json
from math import cos, radians
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[2]


def bounds_for(points: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [(lon + 180) % 360 - 180 for lon, _ in points]
    ys = [lat for _, lat in points]
    if max(xs) - min(xs) > 180:
        xs = [lon if lon >= 0 else lon + 360 for lon in xs]
    return min(xs), min(ys), max(xs), max(ys)


def main() -> None:
    audit = json.loads((ROOT / "work/geography/source-audit.json").read_text())
    identifiers = {item["id"] for item in audit["missing"]}
    report = {"missing_count": len(identifiers), "unlocated": [], "bounds": []}
    if identifiers:
        key = hashlib.sha256(json.dumps(sorted(identifiers)).encode()).hexdigest()[:12]
        target = ROOT / f"data/raw/unassembled-{key}.osm.pbf"
        source = ROOT / "data/raw/russia-261024.osm.pbf"
        if not target.is_file():
            with osmium.BackReferenceWriter(
                target, source, remove_tags=False, relation_depth=10
            ) as writer:
                processor = osmium.FileProcessor(str(source), osmium.osm.WAY | osmium.osm.RELATION)
                processor = processor.with_filter(
                    osmium.filter.IdFilter([int(key[1:]) for key in identifiers])
                )
                for item in processor:
                    identifier = ("w" if isinstance(item, osmium.osm.Way) else "r") + str(item.id)
                    if identifier in identifiers:
                        writer.add(item)
        bounds = {}
        relations = {}
        for item in osmium.FileProcessor(str(target)).with_locations("flex_mem"):
            if isinstance(item, osmium.osm.Node) and item.location.valid():
                bounds[f"n{item.id}"] = (item.lon, item.lat, item.lon, item.lat)
            elif isinstance(item, osmium.osm.Way):
                if item.nodes and all(node.location.valid() for node in item.nodes):
                    bounds[f"w{item.id}"] = bounds_for(
                        [(node.lon, node.lat) for node in item.nodes]
                    )
            elif isinstance(item, osmium.osm.Relation):
                relations[f"r{item.id}"] = tuple(
                    member.type + str(member.ref) for member in item.members
                )
        for _ in range(11):
            for identifier, members in relations.items():
                if (
                    identifier not in bounds
                    and members
                    and all(member in bounds for member in members)
                ):
                    points = []
                    for member in members:
                        west, south, east, north = bounds[member]
                        points.extend([(west, south), (east, north)])
                    bounds[identifier] = bounds_for(points)
        gaps = []
        for identifier in sorted(identifiers):
            if identifier not in bounds:
                report["unlocated"].append(identifier)
                continue
            west, south, east, north = bounds[identifier]
            dy = 50 / 111200
            dx = dy / max(cos(radians((south + north) / 2)), 0.01)
            west, south, east, north = west - dx, south - dy, east + dx, north + dy
            if east > 180:
                gaps.extend([(west, south, 180, north), (-180, south, east - 360, north)])
            elif west < -180:
                gaps.extend([(west + 360, south, 180, north), (-180, south, east, north)])
            else:
                gaps.append((west, south, east, north))
        report["bounds"] = gaps
    (ROOT / "work/geography/gap-bounds.json").write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "missing_objects": len(identifiers),
                "unlocated": len(report["unlocated"]),
                "exclusion_boxes": len(report["bounds"]),
            }
        )
    )


if __name__ == "__main__":
    main()
