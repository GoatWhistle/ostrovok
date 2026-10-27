import asyncio
import contextvars
import json
import time
from pathlib import Path

import httpx

from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.main import create_app

ROOT = Path('/diagnostics')
CURRENT = contextvars.ContextVar('case', default='unknown')
ORIGINAL = DataTools.execute

async def traced(self, action, arguments):
    started = time.monotonic()
    try:
        result = await ORIGINAL(self, action, arguments)
    except Exception as error:
        result = {'error': type(error).__name__ + ': ' + str(error)}
        raise
    finally:
        with (ROOT / (CURRENT.get() + '-tools.jsonl')).open('a') as stream:
            stream.write(json.dumps({'tool': action, 'arguments': arguments, 'result': locals().get('result'), 'seconds': round(time.monotonic()-started, 2)}, ensure_ascii=False, default=str) + '\n')
    return result

DataTools.execute = traced

async def main():
    cases = json.loads((ROOT / 'cases.json').read_text())
    app = create_app()
    gate = asyncio.Semaphore(2)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://local',timeout=1000) as client:
            async def run(case):
                async with gate:
                    CURRENT.set(case['id'])
                    started = time.monotonic()
                    try:
                        response = await client.post('/api/v1/chat/messages', json={'message':case['query'],'region_id':'russia','locale':'ru'})
                        payload = response.json()
                        result = {**case,'seconds':round(time.monotonic()-started, 1),'http_status':response.status_code,'response':payload}
                    except Exception as error:
                        result = {**case,'seconds':round(time.monotonic()-started, 1),'error':type(error).__name__ + ': ' + str(error)}
                    (ROOT / (case['id'] + '-result.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
                    hotels = (result.get('response',{}).get('search') or {}).get('results',[])
                    print(json.dumps({'id':case['id'],'seconds':result['seconds'],'hotels':[h.get('name') or h.get('hotel',{}).get('name') for h in hotels],'error':result.get('error')},ensure_ascii=False),flush=True)
            await asyncio.gather(*(run(case) for case in cases))
asyncio.run(main())
