import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASES = [
('Сочи', 'Хочу тихий двухместный номер в Сочи, рядом море и место, где можно наблюдать летучих мышей вечером.'),
('Казань', 'Нужен отель в Казани с завтраком, недалеко от Казанки, и чтобы из окна высокого этажа ничто не перекрывало вид на реку.'),
('Санкт-Петербург', 'Ищу отель в Санкт-Петербурге рядом с метро и джазовым концертом вечером 7 ноября 2026 года.'),
('Москва', 'Нужен отель в Москве с парковкой, рядом круглосуточный магазин и место, где можно посмотреть на звёзды без городской засветки.'),
('Калининград', 'Хочу отель в Калининграде с рестораном, рядом старинные форты и возможность увидеть закат из окна.'),
('Кисловодск', 'Нужен тихий отель в Кисловодске с завтраком, высоко на склоне, чтобы утром солнце попадало в окно и до парка идти не больше 15 минут.'),
('Екатеринбург', 'Ищу двухместный номер в Екатеринбурге рядом с кафе и заброшенной водонапорной башней, которую можно увидеть с улицы.'),
('Владивосток', 'Хочу отель во Владивостоке с Wi-Fi, видом на корабли из окна и без крутого подъёма пешком от остановки.'),
('Ярославль', 'Нужен отель в Ярославле с семейным номером, рядом набережная и место, где дети смогут увидеть бобров в природе.'),
('Новосибирск', 'Ищу отель в Новосибирске рядом с метро, с бассейном и возможностью увидеть северное сияние из номера 7 ноября 2026 года.')]

def run(case):
    number, (city, query) = case
    record = dict(id=number, city=city, query=query, started_at=datetime.now(timezone.utc).isoformat())
    started = time.monotonic()
    req = urllib.request.Request('http://127.0.0.1:8080/api/v1/chat/messages', data=json.dumps(dict(message=query, region_id='russia', locale='ru')).encode(), headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=210) as response:
            record.update(status=response.status, response=json.load(response))
    except urllib.error.HTTPError as error:
        record.update(status=error.code, error=error.read().decode(errors='replace')[:2000])
    except Exception as error:
        record['error'] = str(error)
    record['elapsed_s'] = round(time.monotonic()-started, 2)
    (ROOT / f'{number:02}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    body = record.get('response', {})
    search = body.get('search') or {}
    print(json.dumps(dict(id=number, city=city, status=record.get('status'), elapsed_s=record['elapsed_s'], hotels=len(search.get('results', [])), parsed=search.get('parsed'), answer=next((m['content'] for m in reversed(body.get('messages', [])) if m['role']=='assistant'), None)), ensure_ascii=False), flush=True)

if __name__ == '__main__':
    (ROOT/'plan.json').write_text(json.dumps(dict(created_at=datetime.now(timezone.utc).isoformat(), concurrency=2, fresh_conversation=True, criteria=['HTTP success', 'elapsed time; >30 seconds slow', 'correct city', 'ordinary and unusual wishes retained', 'claims backed by evidence; unknowns explicit'], cases=CASES), ensure_ascii=False, indent=2))
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(run, enumerate(CASES, 1)))
