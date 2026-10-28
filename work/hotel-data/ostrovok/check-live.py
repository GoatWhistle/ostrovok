import asyncio
import json
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

HOTELS = (
    ('w51847429', 'Жемчужина', 'Сочи'),
    ('n932107941', 'Гельвеция', 'Санкт-Петербург'),
    ('r85761', 'Метрополь', 'Москва'),
    ('r3107676', 'Астория', 'Санкт-Петербург'),
    ('w83289881', 'Ривьера', 'Казань'),
)
PARAMS = {'check_in': '2026-11-02', 'check_out': '2026-11-04', 'adults': 2, 'residency': 'ru'}


async def main():
    records = []
    async with httpx.AsyncClient(base_url='http://127.0.0.1:8080/api/v1', timeout=55) as client:
        for hotel_id, name, city in HOTELS:
            started = time.monotonic()
            response = await client.get(f'/hotels/{hotel_id}/offers', params=PARAMS)
            record = {'hotel_id': hotel_id, 'name': name, 'city': city, 'http_status': response.status_code,
                      'elapsed_s': round(time.monotonic() - started, 3), 'body': response.json()}
            records.append(record)
            print(json.dumps(record, ensure_ascii=False), flush=True)
        started = time.monotonic()
        repeated = await client.get(f'/hotels/{HOTELS[0][0]}/offers', params=PARAMS)
        records.append({'hotel_id': HOTELS[0][0], 'repeat': True, 'http_status': repeated.status_code,
                        'elapsed_s': round(time.monotonic() - started, 3), 'body': repeated.json()})
        assert records[0]['body']['checked_at'] == records[-1]['body']['checked_at']
    Path(__file__).with_name('live-results.json').write_text(json.dumps(
        {'checked_at': datetime.now(UTC).isoformat(), 'params': PARAMS, 'records': records},
        ensure_ascii=False, indent=2))


asyncio.run(main())
