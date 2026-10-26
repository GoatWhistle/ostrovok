import asyncio
import json
import time
import sys
from pathlib import Path

import httpx

CASES = [
    ("sopka", "хочу отель прямо под ключевой сопкой", "Камчат"),
    ("hermitage", "отель рядом с Эрмитажем", "Петербург"),
    ("kazan", "отель у Казанского кремля", "Казан"),
    ("teletskoye", "гостиница у Телецкого озера", "Алтай"),
    ("peterhof", "гостиница рядом с Петергофом", "Петер"),
    ("mamaev", "отель у Мамаева кургана", "Волгоград"),
    ("ambiguous", "хочу отель у Белой реки", None),
    ("no_place", "хочу отель у моря", None),
    ("sun", "отель в Сочи, чтобы 28 октября 2026 в 17:00 по Москве солнце было выше горизонта", "Сочи"),
    ("weather", "отель в Сочи, где 28 октября 2026 в 12:00 по Москве температура воздуха выше 15 градусов", "Сочи"),
    ("far_weather", "отель в Казани, где 15 июля 2027 будет точно 27 градусов", "Казан"),
    ("current_weather", "отель в Мурманске, где прямо сейчас солнце выше горизонта", "Мурманск"),
    ("restaurant", "отель на берегу моря в Новороссийске с рестораном", "Новороссийск"),
    ("lake", "отель в Дагестане рядом с озером", "Дагестан"),
    ("zoo", "отель в Новосибирске, зоопарк в радиусе 10 км", "Новосибирск"),
    ("twentyfour", "хочу 2х местный номер в сочи с круглосуточными магазинами", "Сочи"),
    ("internet", "отель в Сочи, где организуют фототуры на диких животных", "Сочи"),
    ("underwater", "неважно где в России, хочу номер под водой, состав номера не важен", None),
    ("castle", "отель в Калининграде в настоящем старинном замке", "Калининград"),
    ("absurd", "в Казани нужен номер, в котором физически отключается гравитация", "Казан"),
]


async def main():
    results = []
    lock = asyncio.Semaphore(2)
    async with httpx.AsyncClient(timeout=115) as client:
        async def one(case):
            identifier, query, expected = case
            async with lock:
                started = time.monotonic()
                try:
                    response = await client.post('http://127.0.0.1:8080/api/v1/search', json={'query': query, 'region_id': 'russia', 'limit': 3})
                    body = response.json()
                    location = body.get('parsed', {}).get('location_hint', '') or ''
                    record = {'id': identifier, 'query': query, 'status': response.status_code, 'elapsed_s': round(time.monotonic()-started, 2), 'location_ok': expected is None or expected.casefold() in location.casefold(), 'body': body}
                except Exception as error:
                    record = {'id': identifier, 'query': query, 'error': str(error)}
                results.append(record)
                Path(__file__).with_name(sys.argv[1] if len(sys.argv)>1 else 'map-geo-research-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                print(json.dumps({key:value for key,value in record.items() if key != 'body'}, ensure_ascii=False), flush=True)
        await asyncio.gather(*(one(case) for case in CASES))


asyncio.run(main())
