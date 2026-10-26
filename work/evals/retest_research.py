import asyncio,json,time
from pathlib import Path
import httpx

QUERIES=[
 'гостиница у Телецкого озера',
 'отель в Сочи, где 28 октября 2026 в 12:00 по Москве температура воздуха выше 15 градусов',
 'отель в Сочи, чтобы 28 октября 2026 в 17:00 по Москве солнце было выше горизонта',
 'отель в Сочи на 5 этаже с западными окнами, чтобы 28 октября 2026 в 17:00 по Москве соседние здания не закрывали солнце',
]
async def main():
 results=[]
 async with httpx.AsyncClient(timeout=110) as client:
  for query in QUERIES:
   started=time.monotonic()
   response=await client.post('http://127.0.0.1:8080/api/v1/search',json={'query':query,'limit':3})
   body=response.json();results.append({'query':query,'status':response.status_code,'elapsed_s':round(time.monotonic()-started,2),'body':body})
   Path(__file__).with_name('research-retests.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
   print(json.dumps({'query':query,'status':response.status_code,'parsed':body.get('parsed'),'hotels':len(body.get('results',[]))},ensure_ascii=False),flush=True)
  for messages in [['хочу отель в Казани','с 1 по 3 ноября 2026 на двоих взрослых, бюджет любой'],['хочу отель под водой','мне не важен город и параметры номера, главное под водой']]:
   conversation_id=None
   for message in messages:
    response=await client.post('http://127.0.0.1:8080/api/v1/chat/messages',json={'message':message,'conversation_id':conversation_id,'region_id':'russia','locale':'ru'})
    body=response.json();conversation_id=body.get('conversation_id',body.get('id',conversation_id))
    print(json.dumps({'chat_message':message,'body':body},ensure_ascii=False),flush=True)
asyncio.run(main())
