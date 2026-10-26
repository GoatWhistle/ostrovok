import gzip
import json
import statistics
import time
from pathlib import Path
from urllib.request import urlopen

root=Path(__file__).parent/'evidence'
source=json.loads((root/'tile-benchmark.json').read_text())
rows=[]
for item in source['rows']:
    if item['place']=='krasnaya-polyana':continue
    url=f"http://127.0.0.1:18082/api/v1/map/tiles/{item['z']}/{item['x']}/{item['y']}.pbf"
    start=time.perf_counter()
    with urlopen(url,timeout=10) as response:body=response.read();status=response.status
    rows.append({**{key:item[key] for key in ['place','z','x','y']},'ms':round((time.perf_counter()-start)*1000,2),'gzip_bytes':len(gzip.compress(body)),'status':status})
report={'date':'2026-10-26','method':'72 sequential first HTTP requests through nginx to API, warm PostGIS/OS, WSL2; empty out-of-bbox Krasnaya Polyana tiles excluded','rows':rows,'max_ms':max(x['ms'] for x in rows),'median_ms':statistics.median(x['ms'] for x in rows),'max_gzip_bytes':max(x['gzip_bytes'] for x in rows)}
(root/'http-tiles.json').write_text(json.dumps(report,indent=2));print({k:v for k,v in report.items() if k!='rows'})
