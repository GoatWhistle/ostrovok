import asyncio, json, sys
from pathlib import Path
import httpx

URL = "https://ostrovok.ru/api/site/multicomplete.json"

async def ask(client, query):
    r = await client.get(URL, params={"query": query, "language": "ru", "limit": 20},
                         headers={"Accept": "application/json",
                                  "Accept-Language": "ru-RU,ru;q=0.9",
                                  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
                         timeout=25)
    r.raise_for_status()
    rows = r.json().get("hotels") or []
    return [{"name": h.get("hotel_name"), "addr": h.get("hotel_address"),
             "region": h.get("region_name"), "cc": h.get("country_code")} for h in rows]

async def main():
    out = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for line in Path(sys.argv[1]).read_text().splitlines():
            hid, name, lat, lon = line.split("|")
            try:
                found = await ask(client, name)
            except Exception as exc:
                rec = {"id": hid, "name": name, "error": f"{type(exc).__name__}: {exc}"}
            else:
                ru = [h for h in found if (h["cc"] or "").upper() == "RU"]
                rec = {"id": hid, "name": name, "coords": [lat, lon],
                       "ru_count": len(ru), "ru": ru[:4]}
            out.append(rec)
            print(json.dumps(rec, ensure_ascii=False), flush=True)
            await asyncio.sleep(1.2)
    Path(sys.argv[2]).write_text(json.dumps(out, ensure_ascii=False, indent=2))

asyncio.run(main())
