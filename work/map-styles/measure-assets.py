import gzip,json
from pathlib import Path
r=Path('work/map-styles/shared');data={}
for folder in ['data','models','vendor','fonts','sprites']:
 files=[p for p in (r/folder).rglob('*') if p.is_file()];data[folder]={'files':len(files),'bytes':sum(p.stat().st_size for p in files),'gzip_bytes':sum(len(gzip.compress(p.read_bytes(),compresslevel=9,mtime=0)) for p in files)}
for name in ['maplibre-gl.mjs','maplibre-gl-worker.mjs','pmtiles.js','basemaps.js','three.core.js','three.module.js','GLTFLoader.js','deck.js','contour.js','suncalc.js']:
 p=r/'vendor'/name;data[name]={'bytes':p.stat().st_size,'gzip_bytes':len(gzip.compress(p.read_bytes(),compresslevel=9,mtime=0))}
Path('work/map-styles/evidence/asset-sizes.json').write_text(json.dumps(data,indent=2))
