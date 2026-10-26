import asyncio
import gzip
import json
import math
import os
from dataclasses import asdict
from pathlib import Path

import psycopg

from hotel_agent.adapters.db.walk_router import PostgresWalkRouter, WalkRouteCache
from hotel_agent.adapters.map_catalog.loader import load_catalog
from hotel_agent.application.walk_refs import walk_feature

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'shared/data'
HOTELS = {'adler':'n11331531334','sochi':'w51847420'}


def collection(connection, table, geometry, bounds, properties, where='true'):
    query = f'''SELECT id,ST_AsGeoJSON(ST_Intersection({geometry},ST_MakeEnvelope(%s,%s,%s,%s,4326)),6),{properties}
    FROM {table} WHERE {geometry} && ST_MakeEnvelope(%s,%s,%s,%s,4326) AND {where} ORDER BY id'''
    rows = connection.execute(query, (*bounds,*bounds))
    return {'type':'FeatureCollection','features':[
        {'type':'Feature','id':str(row[0]),'geometry':json.loads(row[1]),'properties':row[2]} for row in rows
    ]}


async def route(hotel, poi):
    connection=await psycopg.AsyncConnection.connect(os.environ['DATABASE_URL'])
    try:
        paths=await PostgresWalkRouter(connection,WalkRouteCache()).routes(hotel,[poi],500)
        if not paths:return None
        feature=walk_feature(paths[0])
        return {'type':'Feature','id':feature.id,'geometry':feature.geometry,'properties':feature.properties}
    finally:await connection.close()


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    scenes={}
    with psycopg.connect(os.environ['DATABASE_URL']) as connection:
        for name,identifier in HOTELS.items():
            row=connection.execute('SELECT id,name,ST_X(location),ST_Y(location) FROM hotels WHERE id=%s',(identifier,)).fetchone()
            assert row
            _,hotel_name,lon,lat=row
            dx=1000/(111320*math.cos(math.radians(lat)));dy=1000/111320
            bounds=[lon-dx,lat-dy,lon+dx,lat+dy]
            building_props="jsonb_build_object('class',class,'class_source',class_source,'height',CASE WHEN height_source='height' THEN height_m WHEN levels>0 THEN levels*3.2 ELSE COALESCE(height_m,6.4) END,'height_source',CASE WHEN height_source='unknown' THEN 'estimate' ELSE height_source END,'name',tags->>'name')"
            data={'buildings':collection(connection,'buildings','footprint',bounds,building_props,"region_id='sochi'"),
                  'ground':collection(connection,'landcover','geometry',bounds,"jsonb_build_object('class',class,'name',tags->>'name')"),
                  'water':collection(connection,'water_areas','geometry',bounds,"jsonb_build_object('class',class,'kind',tags->>'water')"),
                  'trees':collection(connection,'trees','geometry',bounds,"jsonb_build_object('class',class,'mapped',true)"),
                  'roads':collection(connection,'walk_edges','geometry',bounds,"jsonb_build_object('class',class,'kind',tags->>'highway','name',tags->>'name')","region_id='sochi'"),
                  'beaches':collection(connection,'beaches','geometry',bounds,"jsonb_build_object('class','beach')","region_id='sochi'"),
                  'coast':collection(connection,'coastline','geometry',bounds,"jsonb_build_object('class','coast')","region_id='sochi'")}
            sea=connection.execute("SELECT ST_AsGeoJSON(geometry,6) FROM geo_features WHERE id=%s",('g_route_'+identifier,)).fetchone()
            nearest=connection.execute("SELECT id,tags->>'name',ST_X(location),ST_Y(location) FROM pois WHERE tags->>'amenity' IN ('bar','pub') ORDER BY location <-> ST_SetSRID(ST_Point(%s,%s),4326) LIMIT 1",(lon,lat)).fetchone()
            assert nearest
            walk=asyncio.run(route(identifier,nearest[0]))
            data['water']['features']=[f for f in data['water']['features'] if f['properties'].get('kind')!='sea']
            sea_polygon=connection.execute("SELECT ST_AsGeoJSON(geometry,6) FROM water_areas WHERE id='sea:sochi'").fetchone()
            if sea_polygon:data['water']['features'].append({'type':'Feature','id':'sea:sochi','geometry':json.loads(sea_polygon[0]),'properties':{'class':'water','kind':'sea'}})
            data['routes']={'type':'FeatureCollection','features':[]}
            if sea:data['routes']['features'].append({'type':'Feature','id':'sea-route','geometry':json.loads(sea[0]),'properties':{'kind':'sea'}})
            if walk:data['routes']['features'].append(walk)
            neighbors=list(connection.execute("SELECT id,name,ST_X(location),ST_Y(location) FROM hotels WHERE region_id='sochi' AND id<>%s ORDER BY location <-> ST_SetSRID(ST_Point(%s,%s),4326) LIMIT 2",(identifier,lon,lat)))
            meta={'id':name,'center':[lon,lat],'bbox':bounds,'hotel':{'id':identifier,'name':hotel_name,'location':[lon,lat]},
                  'bar':{'id':nearest[0],'name':nearest[1] or 'Бар без названия','location':[nearest[2],nearest[3]]},
                  'neighbors':[{'id':r[0],'name':r[1],'location':[r[2],r[3]]} for r in neighbors],
                  'counts':{key:len(value['features']) for key,value in data.items()}}
            data['meta']=meta
            encoded=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()
            (OUT/f'{name}.json').write_bytes(encoded)
            scenes[name]={**meta,'bytes':len(encoded),'gzip_bytes':len(gzip.compress(encoded))}
    catalog=[asdict(item) for item in load_catalog(ROOT/'map-catalog').classes]
    (OUT/'catalog.json').write_text(json.dumps(catalog,separators=(',',':')))
    (OUT/'manifest.json').write_text(json.dumps({'scenes':scenes,'sources':{'osm':'OpenStreetMap contributors, ODbL','basemap':'Protomaps 20261026, tileset4.15.2','dem':'Copernicus GLO-30'},'decorations':'Scattered props are illustrative; mapped trees carry mapped=true'},ensure_ascii=False,indent=2))
    print(json.dumps(scenes,ensure_ascii=False))


if __name__=='__main__':main()
