import asyncio, json, re, sys
from pathlib import Path
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.adapters.external.hotel_metadata import HotelMetadata

ROOM_WORDS = re.compile(r"номер|категори|двухместн|одноместн|люкс|апартамент|room", re.I)

async def main():
    rows = [line.split("|") for line in Path(sys.argv[1]).read_text().splitlines() if line]
    web = PublicWebResearch()
    out = []
    for hid, name, addr, city, lon, lat in rows:
        query = f'"{name}" {city} {addr} номера категории оснащение официальный сайт'.strip()
        record = {"id": hid, "name": name, "query": query}
        try:
            found = await web.search(query)
        except Exception as exc:
            record["error"] = f"{type(exc).__name__}: {exc}"
        else:
            record["results"] = [{"url": p.url, "title": p.title,
                                  "room_words": bool(ROOM_WORDS.search(p.text or ""))}
                                 for p in found[:6]]
        out.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        await asyncio.sleep(1.0)
    # read the first result of each hotel and look for room text / JSON-LD
    for record in out:
        first = (record.get("results") or [None])[0]
        if not first:
            continue
        try:
            page = await web.read(first["url"])
        except Exception as exc:
            record["read"] = {"url": first["url"], "error": f"{type(exc).__name__}: {exc}"}
        else:
            parser = HotelMetadata()
            parser.feed(page.text or "")
            hits = ROOM_WORDS.findall(page.text or "")
            record["read"] = {"url": page.url, "title": page.title,
                              "chars": len(page.text or ""), "room_word_hits": len(hits),
                              "jsonld_hotel_records": len(parser.records)}
        print(json.dumps(record.get("read"), ensure_ascii=False), flush=True)
        await asyncio.sleep(1.0)
    await web.aclose()
    Path(sys.argv[2]).write_text(json.dumps(out, ensure_ascii=False, indent=2))

asyncio.run(main())
