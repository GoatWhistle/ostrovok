import asyncio,os,json
from dataclasses import asdict
from hotel_agent.settings import load_settings
from hotel_agent.composition import build_providers
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry
from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.window_views import WindowViews
from hotel_agent.adapters.external.overpass_geography import OverpassGeography
from hotel_agent.application.use_cases.ensure_geography import EnsureGeography
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from hotel_agent.application.agent.requested_tools import RequestedTools
from hotel_agent.domain.query import ParsedQuery,SpatialRequest
async def main():
 c=load_settings(os.environ); log=StdlibLogger('probe'); p=build_providers(c,log)
 source=OverpassGeography(c.geography_api_url)
 geo=OSMViewGeometry(c.terrain_cache_dir.parent/'view-geometry',context=EnsureGeography(p.uow,source,p.clock,log))
 terrain=CountryTerrainTiles(c.seed_dir/'sochi'/'dem.tif',c.terrain_cache_dir)
 try:
  candidates=await find_candidates('отель в ижевске с видом на пруд','Ижевск','russia',None,p.uow,None,None,None)
  request=SpatialRequest(kind='landmark_view',target='Ижевский пруд',radius_m=2000,source_text='с видом на пруд',target_osm_key='natural',target_osm_values=('water',))
  parsed=ParsedQuery(intents=(),unmatched_terms=(),location_hint='Ижевск',spatial_requests=(request,))
  native=RequestedTools(parsed,'Ижевск','russia',p.uow,p.clock,p.place_lookup,EvaluateWindowViews(p.uow,WindowViews(terrain,geo)))
  result=await native.check('с видом на пруд',candidates.hotels,candidates.bbox)
  print(json.dumps({'hotels':{h.id:h.name for h in candidates.hotels},'facts':[asdict(f) for f in result.facts]},ensure_ascii=False,default=str),flush=True)
 finally:
  await geo.aclose(); await source.aclose(); terrain.close(); await p.aclose()
asyncio.run(main())
