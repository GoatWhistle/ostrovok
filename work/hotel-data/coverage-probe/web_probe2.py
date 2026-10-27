import asyncio, json, sys
from pathlib import Path
from hotel_agent.adapters.external.web_research import PublicWebResearch

CASES = [
    ('Союз', 'Иваново', 'Шереметевский проспект 47'),
    ('Гостиница Кедр', 'Абаза', 'Парковая улица 4'),
    ('Виноград', 'Кацивели', 'Лименская улица 5'),
    ('Центральная', 'Киров', ''),
    ('Отель на Еловом', 'Миасс', ''),
    ('Прикумск', 'Будённовск', 'улица Борцов Революции 168'),
]

async def main():
    web = PublicWebResearch()
    out = []
    for name, city, addr in CASES:
        query = f'"{name}" {city} {addr} номера категории официальный сайт'.strip()
        try:
            hits = await web.search(query)
        except Exception as exc:
            record = {"name": name, "error": f"{type(exc).__name__}: {exc}"}
        else:
            record = {"name": name, "city": city, "hits": [
                {"url": h.url, "title": h.title[:70]} for h in hits]}
        out.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        await asyncio.sleep(2.0)
    await web.aclose()
    Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False, indent=2))

asyncio.run(main())
