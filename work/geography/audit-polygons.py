import asyncio
import json
from argparse import ArgumentParser
from array import array
from pathlib import Path

import numpy as np
import osmium
import psycopg

from hotel_agent.adapters.osm.tags import is_beach, is_building

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/raw/russia-polygons-261024.osm.pbf"


def object_key(identifier: str, beach: bool = False) -> int:
    return int(identifier[1:]) * 4 + (2 if identifier.startswith("r") else 0) + int(beach)


def source_keys() -> np.ndarray:
    values = array("Q")
    for item in osmium.FileProcessor(str(SOURCE), osmium.osm.WAY | osmium.osm.RELATION):
        tags = dict(item.tags)
        if not tags:
            continue
        identifier = ("w" if isinstance(item, osmium.osm.Way) else "r") + str(item.id)
        if is_building(tags):
            values.append(object_key(identifier))
        if is_beach(tags):
            values.append(object_key(identifier, True))
    return np.frombuffer(values, dtype=np.uint64).copy()


async def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    cache = ROOT / "data/raw/russia-polygon-keys.npy"
    metadata = ROOT / "data/raw/russia-polygon-keys.json"
    identity = {"size": SOURCE.stat().st_size, "mtime_ns": SOURCE.stat().st_mtime_ns}
    if cache.is_file() and metadata.is_file() and json.loads(metadata.read_text()) == identity:
        expected = np.load(cache, mmap_mode="r", allow_pickle=False)
    else:
        expected = await asyncio.to_thread(source_keys)
        np.save(cache, expected, allow_pickle=False)
        metadata.write_text(json.dumps(identity) + "\n")
    print(f"expected_source_layers={len(expected)}", flush=True)
    if args.prepare_only:
        return
    report = json.loads((ROOT / "work/geography/import-result.json").read_text())
    if report.get("success") is not True:
        raise ValueError("Import must finish successfully before auditing coverage")
    present = array("Q")
    connection = await psycopg.AsyncConnection.connect(
        "postgresql://hotel:hotel@localhost:5432/hotel"
    )
    try:
        for beach, query in ((False, "SELECT id FROM buildings"), (True, "SELECT id FROM beaches")):
            async with connection.cursor(name="geography_source_audit") as cursor:
                await cursor.execute(query)
                while rows := await cursor.fetchmany(100000):
                    present.extend(
                        object_key(str(row[0]), beach)
                        for row in rows
                        if str(row[0])[0:1] in {"w", "r"} and str(row[0])[1:].isdecimal()
                    )
            print(f"read_database_ids={len(present)}", flush=True)
    finally:
        await connection.close()
    missing = np.setdiff1d(expected, np.frombuffer(present, dtype=np.uint64), assume_unique=False)
    records = [
        {
            "id": ("r" if int(value) % 4 >= 2 else "w") + str(int(value) // 4),
            "layer": "beaches" if int(value) % 2 else "buildings",
        }
        for value in missing
    ]
    result = {"expected_layers": len(expected), "missing_count": len(records), "missing": records}
    (ROOT / "work/geography/source-audit.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "missing"}), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
