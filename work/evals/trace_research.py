import asyncio
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

import httpx

from hotel_agent.main import create_app
from hotel_agent.settings import load_settings


async def main():
    env=dict(os.environ)
    for line in Path('../.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);env[k]=v.strip().strip('"').strip("'")
    env['CHARACTERISTICS_DIR']='../characteristics'
    env['SEED_DIR']='../data/seed'
    env['DATABASE_URL']='postgresql://hotel:hotel@localhost:5432/hotel'
    app=create_app(load_settings(env))
    async with app.router.lifespan_context(app):
        llm=app.state.providers.llm
        original=llm.explore_data
        async def trace(context):
            data=json.loads(context)
            step=await original(context)
            print(json.dumps({'terms': data['terms'], 'observations': data['observations'][-1], 'step':asdict(step)},ensure_ascii=False),flush=True)
            return step
        llm.explore_data=trace
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app),base_url='http://local',timeout=100) as client:
            response=await client.post('/api/v1/search',json={'query':sys.argv[1] if len(sys.argv)>1 else 'отель в Сочи, где 28 октября 2026 в 12:00 по Москве температура воздуха выше 15 градусов','limit':3})
            print(response.status_code, response.json()['parsed'])

asyncio.run(main())
