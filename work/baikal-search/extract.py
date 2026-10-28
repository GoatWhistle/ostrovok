from pathlib import Path
import osmium
source=Path('/srv/data/raw/russia-261024.osm.pbf')
target=Path('/srv/cache/view-geometry/r555716.osm')
if not target.exists():
 with osmium.BackReferenceWriter(target,source,remove_tags=False,relation_depth=5) as writer:
  for item in osmium.FileProcessor(str(source),osmium.osm.RELATION):
   if item.id==555716:
    writer.add(item)
    print('selected',item.id,flush=True)
    break
print('bytes',target.stat().st_size,flush=True)
