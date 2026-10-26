import asyncio
import json
import os
import statistics
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter

import psycopg

from hotel_agent.adapters.db.walk_router import PostgresWalkRouter, WalkRouteCache

CASES = {
    "n4712092442": ["w713692556", "w713972246"],
    "w98649229": ["n10873811667", "n4634757303", "n9223804761", "w713692556", "w713972246"],
}


async def main() -> None:
    records = []
    connection = await psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"])
    try:
        for hotel, places in CASES.items():
            cold, warm = [], []
            modes = []
            for _ in range(10):
                router = PostgresWalkRouter(connection, WalkRouteCache())
                start = perf_counter()
                routes = await router.routes(hotel, places, 500)
                cold.append((perf_counter() - start) * 1000)
                modes = [route.mode for route in routes]
                start = perf_counter()
                await router.routes(hotel, places, 500)
                warm.append((perf_counter() - start) * 1000)
            records.append({
                "hotel": hotel, "places": len(places), "samples": 10,
                "uncached_median_ms": round(statistics.median(cold), 2),
                "uncached_max_ms": round(max(cold), 2),
                "cached_median_ms": round(statistics.median(warm), 3),
                "modes": modes,
            })
    finally:
        await connection.close()
    payload = {
        "at": datetime.now(UTC).isoformat(),
        "method": "10 empty route caches per hotel, each followed by a cached call; warm PostGIS buffers; local WSL host; includes SQL, parsing, graph and Dijkstra",
        "results": records,
    }
    target = Path(__file__).parent / "evidence" / "walk-benchmark.json"
    target.write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload))


asyncio.run(main())
