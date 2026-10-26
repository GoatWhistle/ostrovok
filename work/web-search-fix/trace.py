import asyncio
import json
import httpx
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.main import create_app

original = DataTools.execute

async def traced(self, action, arguments):
    try:
        result = await original(self, action, arguments)
    except Exception as error:
        print(json.dumps({'tool':action,'arguments':arguments,'error':str(error)},ensure_ascii=False),flush=True)
        raise
    if True:
        print(json.dumps({'tool':action,'arguments':arguments,'result':result},ensure_ascii=False,default=str)[:18000],flush=True)
    return result

DataTools.execute = traced

async def main():
    app=create_app()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://local') as client:
            response=await client.post('/api/v1/chat/messages',json={'message':'хочу отель в Москве, в котором останавливался сам трамп','region_id':'russia'})
            print('FINAL',response.text,flush=True)
asyncio.run(main())
