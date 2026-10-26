import asyncio,json,time
from pathlib import Path
import httpx

async def main():
 data=json.loads(Path(__file__).with_name('map-geo-research-final.json').read_text())
 wanted=set()
 for row in data:
  for hotel in row.get('body',{}).get('results',[]):
   for match in hotel.get('matched',[]):
    if match.get('fact'): wanted.add((hotel['hotel']['id'],match['fact']['fact_id']))
 lock=asyncio.Semaphore(6)
 results=[]
 async with httpx.AsyncClient(timeout=15) as client:
  async def check(pair):
   async with lock:
    started=time.monotonic();r=await client.get(f'http://127.0.0.1:8080/api/v1/hotels/{pair[0]}/facts/{pair[1]}')
    results.append({'hotel_id':pair[0],'fact_id':pair[1],'status':r.status_code,'elapsed_s':round(time.monotonic()-started,3)})
  await asyncio.gather(*(check(pair) for pair in sorted(wanted)))
 Path(__file__).with_name('fact-links-final.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
 print({'checked':len(results),'http_200':sum(r['status']==200 for r in results),'max_s':max(r['elapsed_s'] for r in results)})
 assert all(r['status']==200 for r in results)
asyncio.run(main())
