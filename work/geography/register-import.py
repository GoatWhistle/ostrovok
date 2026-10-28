import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb
from shapely import union_all
from shapely.geometry import Polygon, box, mapping, shape

ROOT = Path(__file__).resolve().parents[2]

SQL = """WITH polygons AS (
 SELECT (ST_Dump(ST_GeomFromGeoJSON(%(geometry)s))).geom AS geom
)
INSERT INTO geography_coverage(id,bbox,source_url,fetched_at,valid_until,complete,counts)
SELECT 'pbf:' || md5(ST_AsEWKB(geom)::text),geom,%(source)s,%(now)s,%(until)s,true,%(counts)s
FROM polygons WHERE NOT ST_IsEmpty(geom)
ON CONFLICT(id) DO UPDATE SET source_url=EXCLUDED.source_url,fetched_at=EXCLUDED.fetched_at,
 valid_until=EXCLUDED.valid_until,complete=EXCLUDED.complete,counts=EXCLUDED.counts"""


def coverage_polygon(path: Path) -> str:
    outer, inner = [], []
    lines = iter(path.read_text().splitlines()[1:])
    for line in lines:
        name = line.strip()
        if name == "END":
            break
        if not name:
            continue
        ring = []
        for line in lines:
            if line.strip() == "END":
                break
            lon, lat = map(float, line.split())
            ring.append((lon, lat))
        (inner if name.startswith("!") else outer).append(Polygon(ring))
    area = union_all(outer).difference(union_all(inner)).intersection(box(-180, 41, 180, 82))
    if not area.is_valid or area.is_empty:
        raise ValueError("The source extract coverage polygon is invalid")
    return json.dumps(mapping(area))


async def main() -> None:
    report = json.loads((ROOT / "work/geography/import-result.json").read_text())
    if report.get("success") is not True or set(report["counts"]) != {"buildings", "beaches"}:
        raise ValueError("A successful full buildings/beaches import report is required")
    audit = json.loads((ROOT / "work/geography/source-audit.json").read_text())
    gaps = json.loads((ROOT / "work/geography/gap-bounds.json").read_text())
    if gaps["unlocated"]:
        raise ValueError("Source objects without coordinates cannot be marked as complete coverage")
    if len({item["id"] for item in audit["missing"]}) != gaps["missing_count"]:
        raise ValueError("The geometry gap audit does not match the source audit")
    geometry = coverage_polygon(ROOT / "data/raw/russia.poly")
    if gaps["bounds"]:
        area = shape(json.loads(geometry)).difference(
            union_all([box(*bounds) for bounds in gaps["bounds"]])
        )
        if not area.is_valid or area.is_empty:
            raise ValueError("Coverage excluding invalid geometry is not valid")
        geometry = json.dumps(mapping(area))
    now = datetime.now(UTC)
    connection = await psycopg.AsyncConnection.connect(
        "postgresql://hotel:hotel@localhost:5432/hotel"
    )
    try:
        cursor = await connection.execute(
            SQL,
            {
                "geometry": geometry,
                "source": "https://download.geofabrik.de/russia-261024.osm.pbf",
                "now": now,
                "until": now + timedelta(days=30),
                "counts": Jsonb(report["counts"]),
            },
        )
        await connection.commit()
        print(f"registered_coverage_polygons={cursor.rowcount}")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
