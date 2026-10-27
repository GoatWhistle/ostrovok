import asyncio, json, sys, time
from pathlib import Path
import httpx

PARAMS = {"check_in": "2026-11-10", "check_out": "2026-11-12", "adults": 2, "residency": "ru"}

def load(path, group):
    rows = []
    for line in Path(path).read_text().splitlines():
        parts = line.split("|")
        if len(parts) >= 2 and parts[0]:
            rows.append({"group": group, "id": parts[0], "name": parts[1],
                         "street": parts[2] if len(parts) > 2 else "",
                         "city": parts[3] if len(parts) > 3 else ""})
    return rows

async def one(client, sem, row):
    async with sem:
        started = time.monotonic()
        try:
            r = await client.get(f"/hotels/{row['id']}/offers", params=PARAMS)
            body = r.json()
        except Exception as exc:
            row |= {"http": None, "status": f"client_error:{type(exc).__name__}"}
        else:
            row |= {"http": r.status_code,
                    "status": body.get("status") or body.get("error", {}).get("code"),
                    "offers": len(body.get("offers") or []),
                    "categories": len(body.get("room_categories") or []),
                    "facilities": len(body.get("facilities") or [])}
        row["elapsed_s"] = round(time.monotonic() - started, 2)
        print(json.dumps(row, ensure_ascii=False), flush=True)
        await asyncio.sleep(1.0)
        return row

async def main():
    rows = load(sys.argv[1], "with_street") + load(sys.argv[2], "no_street")
    sem = asyncio.Semaphore(2)
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8080/api/v1", timeout=90) as client:
        out = await asyncio.gather(*(one(client, sem, row) for row in rows))
    Path(sys.argv[3]).write_text(json.dumps({"params": PARAMS, "rows": out}, ensure_ascii=False, indent=2))
    tally = {}
    for row in out:
        key = (row["group"], row.get("status"))
        tally[key] = tally.get(key, 0) + 1
    for key in sorted(tally, key=str):
        print(key, tally[key])

asyncio.run(main())
