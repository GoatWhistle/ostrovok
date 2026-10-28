import asyncio
import json
import math
import time
from pathlib import Path

import httpx
import psycopg

ROOT = Path(__file__).resolve().parents[2]
CITIES = (
    ("Moscow", 37.618, 55.752),
    ("Saint Petersburg", 30.315, 59.939),
    ("Kazan", 49.122, 55.788),
    ("Vladivostok", 131.89, 43.12),
    ("Makhachkala", 47.50, 42.98),
    ("Murmansk", 33.08, 68.97),
    ("Kaliningrad", 20.50, 54.71),
    ("Novosibirsk", 82.92, 55.03),
    ("Sochi", 39.726, 43.588),
    ("Novorossiysk", 37.768, 44.722),
    ("Irkutsk", 104.28, 52.287),
    ("Petropavlovsk-Kamchatsky", 158.656, 53.02),
    ("Yuzhno-Sakhalinsk", 142.735, 46.959),
    ("Anadyr", 177.51, 64.73),
)

NEAREST_SQL = """SELECT h.id,h.name,ST_X(h.location),ST_Y(h.location)
FROM hotels h WHERE h.name <> h.id AND ST_DWithin(h.location::geography,
 ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326)::geography,5000)
ORDER BY h.location <-> ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326) LIMIT 1"""


async def main() -> None:
    connection = await psycopg.AsyncConnection.connect(
        "postgresql://hotel:hotel@localhost:5432/hotel", autocommit=True
    )
    records = []
    try:
        async with httpx.AsyncClient(base_url="http://localhost:8080", timeout=30) as client:
            for city, lon, lat in CITIES:
                row = await (
                    await connection.execute(NEAREST_SQL, {"lon": lon, "lat": lat})
                ).fetchone()
                if row is None:
                    records.append(
                        {"city": city, "error": "No catalog hotel within five kilometres"}
                    )
                    continue
                url = f"/api/v1/hotels/{row[0]}/scene?context_radius_m=500"
                durations = []
                for _ in range(2):
                    start = time.monotonic()
                    response = await client.get(url)
                    durations.append(round(time.monotonic() - start, 3))
                    response.raise_for_status()
                scene = response.json()
                records.append(
                    {
                        "city": city,
                        "hotel_id": row[0],
                        "name": row[1],
                        "location": [row[2], row[3]],
                        "timings_s": durations,
                        "http_status": response.status_code,
                        "scene": scene,
                    }
                )
            terrain = []
            for city, lon, lat in (CITIES[3], CITIES[5], CITIES[10], CITIES[11], CITIES[13]):
                z = 12
                x = int((lon + 180) / 360 * 2**z)
                y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z)
                start = time.monotonic()
                response = await client.get(f"/api/v1/map/terrain/{z}/{x}/{y}.png")
                terrain.append(
                    {
                        "city": city,
                        "tile": [z, x, y],
                        "http_status": response.status_code,
                        "seconds": round(time.monotonic() - start, 3),
                        "bytes": len(response.content),
                        "valid_png": response.content.startswith(b"\x89PNG\r\n\x1a\n"),
                    }
                )
            report = {"scenes": records, "terrain": terrain}
            (ROOT / "work/geography/stand-check.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n"
            )
            print(
                json.dumps(
                    {
                        "scenes": [
                            {k: v for k, v in row.items() if k != "scene"} for row in records
                        ],
                        "terrain": terrain,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
