import asyncio,json
from hotel_agent.main import create_app
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence

async def main():
 app=create_app()
 async with app.router.lifespan_context(app):
  p=app.state.providers
  async with p.uow() as u:
   b=await u.regions.city_bbox('Москва');h=await u.search.list_hotels('russia',b)
  web=PublicWebResearch();provider=PublicEvents(web)
  verify=p.llm.verify_evidence
  async def traced(context):
   print('CONTEXT',context,flush=True)
   result=await verify(context)
   print('VERDICTS',str(result),flush=True)
   return result
  p.llm.verify_evidence=traced
  term='рядом с местом проведения концерта Кишлака'
  tools=DataTools(p.uow,None,h,'Москва','russia',b,False,web=web,now=p.clock.now(),terms=(term,),evidence=DocumentEvidence(p.llm,(term,),'хочу снять отель неподалеку от концерта Кишлака в Москве'),places={'read_event_page':provider},llm=p.llm)
  try:
   result=await tools.execute('read_event_page',{'url':'https://afisha.yandex.ru/moscow/concert/kishlak-2026-11','check_in':'2026-11-22T00:00:00+03:00','check_out':'2026-11-23T00:00:00+03:00','radius_m':2000,'term':term})
   print('RESULT',json.dumps({'fields':result.get('fields'),'evidence':result.get('evidence'),'matched':sum(bool(x['records']) for x in result.get('measurements',[]))},ensure_ascii=False),flush=True)
  finally:await provider.aclose();await web.aclose()
asyncio.run(main())
