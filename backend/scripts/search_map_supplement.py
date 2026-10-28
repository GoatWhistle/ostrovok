import argparse
import asyncio
import gzip
import hashlib
import json
import os
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

import psycopg
from shapely.geometry import box, shape

from hotel_agent.adapters.db.geography_rows import save_layer
from hotel_agent.adapters.osm.geography_snapshot import parse_snapshot
from hotel_agent.application.dto import Feature


def wanted(feature: Feature) -> bool:
    tags = feature.properties
    return (
        tags.get("amenity") in {"bar", "theatre", "pharmacy"}
        or tags.get("shop") in {"supermarket", "convenience"}
        or bool(
            tags.get("name")
            and (
                tags.get("place") == "square"
                or tags.get("highway") in {"pedestrian", "footway", "path"}
                or tags.get("leisure") in {"park", "garden"}
                or tags.get("tourism") == "attraction"
            )
        )
    )


def build(raw: Path, output: Path) -> None:
    sources = json.loads((raw / "sources.json").read_text()) + json.loads(
        (raw / "central-sources.json").read_text()
    )
    layers: dict[str, dict[str, Feature]] = {"pois": {}, "walk": {}}
    for source in sources:
        if source["status"] != 0:
            continue
        payload = (raw / (source["area"] + ".osm")).read_bytes()
        if hashlib.sha256(payload).hexdigest() != source["sha256"]:
            raise ValueError("Source hash does not match manifest")
        snapshot = parse_snapshot(payload, tuple(source["bbox"]), source["source_url"])
        boundary = box(*source["bbox"])
        for feature in snapshot.layers.pois:
            if wanted(feature):
                layers["pois"][feature.id] = feature
        for feature in snapshot.layers.walk:
            if shape(feature.geometry).intersects(boundary):
                layers["walk"][feature.id] = feature
        source["snapshot_complete"] = snapshot.complete
    output.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for layer, features in layers.items():
        payload = json.dumps(
            [asdict(f) for f in sorted(features.values(), key=lambda f: f.id)], ensure_ascii=False
        ).encode()
        compressed = gzip.compress(payload, mtime=0)
        (output / f"{layer}.json.gz").write_bytes(compressed)
        hashes[layer] = hashlib.sha256(compressed).hexdigest()
    metadata = {
        "region": "sochi",
        "fetched_at": datetime.now(UTC).isoformat(),
        "license": "ODbL",
        "sources": sources,
        "counts": {name: len(rows) for name, rows in layers.items()},
        "sha256": hashes,
        "scope": "Selected real POI categories and walk edges only; no hotel facts or synthetic connectivity",
    }
    (output / "meta.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(metadata["counts"]))


async def apply(directory: Path, write: bool) -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL is required")
    meta = json.loads((directory / "meta.json").read_text())
    if meta["region"] != "sochi":
        raise ValueError("Expected Sochi supplement")
    connection = await psycopg.AsyncConnection.connect(url)
    report = {}
    try:
        for layer, table in (("pois", "pois"), ("walk", "walk_edges")):
            payload = (directory / f"{layer}.json.gz").read_bytes()
            if hashlib.sha256(payload).hexdigest() != meta["sha256"][layer]:
                raise ValueError("Seed hash does not match manifest")
            rows = json.loads(gzip.decompress(payload))
            features = [
                Feature(id=row["id"], geometry=row["geometry"], properties=row["properties"])
                for row in rows
            ]
            cursor = await connection.execute(
                f"SELECT count(*) FROM {table} WHERE id=ANY(%s)", ([f.id for f in features],)
            )
            present = await cursor.fetchone()
            existing = int(present[0]) if present else 0
            report[layer] = {
                "incoming": len(features),
                "existing": existing,
                "new": len(features) - existing,
            }
            if write:
                await save_layer(connection, "sochi", layer, features)
        if write:
            await connection.commit()
        else:
            await connection.rollback()
    finally:
        await connection.close()
    print(json.dumps({"applied": write, "counts": report}))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--build-from", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.build_from:
        build(args.build_from, args.directory)
    else:
        asyncio.run(apply(args.directory, args.apply))


if __name__ == "__main__":
    main()
