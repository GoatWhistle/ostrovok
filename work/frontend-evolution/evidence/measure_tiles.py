import asyncio
import gzip
import json
import math
import os
import statistics
import time
from pathlib import Path

import mapbox_vector_tile
import psycopg

from hotel_agent.adapters.db.map_tiles import PostgresMapTileRepository


async def main() -> None:
    rows = []
    async with await psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"]) as connection:
        repository = PostgresMapTileRepository(connection)
        for name, lon, lat in [
            ("center", 39.7233, 43.5855),
            ("shore", 39.9668263, 43.3989565),
            ("mountain", 40.312, 43.666),
        ]:
            for z in ([2, 6, 8] if name == "center" else []) + [10, 12, 13, 14, 15, 16, 17]:
                x = int((lon + 180) / 360 * 2**z)
                y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z)
                samples = []
                payload = b""
                for _ in range(6):
                    start = time.perf_counter()
                    payload = await repository.get(z, x, y)
                    samples.append(round((time.perf_counter() - start) * 1000, 2))
                decoded = mapbox_vector_tile.decode(payload)
                result = await connection.execute(
                    "SELECT count(*) FROM buildings WHERE footprint && "
                    "ST_Transform(ST_TileEnvelope(%s,%s,%s),4326)",
                    (z, x, y),
                )
                source = await result.fetchone()
                rows.append({
                    "name": name, "z": z, "x": x, "y": y,
                    "bytes": len(payload), "gzip_bytes": len(gzip.compress(payload)),
                    "first_ms": samples[0], "warm_ms": samples[1:],
                    "source_buildings": source[0] if source else 0,
                    "layers": {key: len(value["features"]) for key, value in decoded.items()},
                })
    warm = [sample for row in rows for sample in row["warm_ms"]]
    report = {
        "method": "24 unique tiles; first request separated; five warm SQL+MVT requests per tile",
        "p95_ms": statistics.quantiles(warm, n=100)[94],
        "max_warm_ms": max(warm), "samples": len(warm), "tiles": rows,
    }
    output = Path(os.environ["TILE_EVIDENCE"])
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "tiles"}))


asyncio.run(main())
