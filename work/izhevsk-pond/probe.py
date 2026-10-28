import asyncio, os, json
from dataclasses import asdict
from hotel_agent.settings import load_settings
from hotel_agent.composition import build_providers
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry
async def main():
 config=load_settings(os.environ)
 p=build_providers(config,StdlibLogger('probe'))
 geo=OSMViewGeometry(config.terrain_cache_dir.parent/'view-geometry')
 try:
  candidates=await find_candidates('отель в ижевске с видом на пруд','Ижевск','russia',None,p.uow,None,None,None)
  async with p.uow() as uow:
   for name in ('пруд','Ижевский пруд'):
    result=await uow.named_places.by_name(name,candidates.bbox,'natural',('water',))
    print('LOOKUP',name,result,flush=True)
  obj=await geo.object('r17062660')
  print('GEOMETRY',None if obj is None else {'tags':obj.tags,'type':obj.geometry['type']},flush=True)
 finally:
  await geo.aclose()
  await p.aclose()
asyncio.run(main())
