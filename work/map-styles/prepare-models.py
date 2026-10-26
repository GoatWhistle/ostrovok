import os
from pathlib import Path
import json,struct,zipfile,shutil
r=Path('work/map-styles/shared/models');r.mkdir(exist_ok=True)
models=[('pine','nature','tree_pineTallA'),('pine-small','nature','tree_pineDefaultA'),('oak','nature','tree_oak'),('palm','nature','tree_palm'),('bush','nature','plant_bush'),('rock','nature','stone_smallA'),('canoe','nature','canoe'),('cafe-tent','nature','tent_smallOpen'),('log','nature','log'),('bench','holiday','bench'),('lamp','holiday','lantern'),('rowboat','watercraft','boat-row-small'),('speedboat','watercraft','boat-speed-a'),('sailboat','watercraft','boat-sail-a'),('planter','suburban','planter')]
manifest=[]
for key,pack,name in models:
 with zipfile.ZipFile(Path(os.environ.get('MAP_MODEL_ARCHIVES','data/raw/kenney'))/f'{pack}.zip') as z:
  candidates=[p for p in z.namelist() if p.endswith('/'+name+'.glb')]
  if not candidates:
   print('missing',key,name);continue
  content=z.read(candidates[0]);length=struct.unpack_from('<I',content,12)[0];doc=json.loads(content[20:20+length])
  triangles=sum(doc['accessors'][p['indices']]['count']//3 if 'indices'in p else doc['accessors'][p['attributes']['POSITION']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
  print(key,triangles)
  if triangles>1500:continue
  (r/f'{key}.glb').write_bytes(content)
  manifest.append({'key':key,'file':f'{key}.glb','pack':pack,'original':candidates[0],'triangles':triangles,'bytes':len(content),'license':'CC0-1.0','color':'vertex colors baked at load; no external textures'})
  license=next(p for p in z.namelist() if p.lower().endswith('license.txt'))
  (r/f'{pack}-LICENSE.txt').write_bytes(z.read(license))
(r/'manifest.json').write_text(json.dumps(manifest,indent=2))
