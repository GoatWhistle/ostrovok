import gzip
import json
import math
import os
import statistics
import time
from pathlib import Path

import psycopg

from hotel_agent.adapters.db.map_tiles import TILE_SQL

centers={'adler':(39.904065,43.4451502),'sochi':(39.7322506,43.5711773),'krasnaya-polyana':(40.199,43.680)}
rows=[]
with psycopg.connect(os.environ['DATABASE_URL']) as connection:
    for place,(lon,lat) in centers.items():
        for z in range(13,17):
            x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    start=time.perf_counter()
                    payload=connection.execute(TILE_SQL,{'z':z,'x':x+dx,'y':y+dy}).fetchone()[0]
                    elapsed=(time.perf_counter()-start)*1000
                    rows.append({'place':place,'z':z,'x':x+dx,'y':y+dy,'ms':round(elapsed,2),'bytes':len(payload),'gzip_bytes':len(gzip.compress(payload))})
report={'date':'2026-10-26','method':'108 sequential first SQL requests, warm running PostGIS/OS, no HTTP or application cache; WSL2, not jury hardware','rows':rows,'max_ms':max(r['ms'] for r in rows),'median_ms':statistics.median(r['ms'] for r in rows),'max_gzip_bytes':max(r['gzip_bytes'] for r in rows)}
Path('work/map-styles/evidence/tile-benchmark.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
