import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).parent/'shared/data/terrain'
manifest=json.loads((OUT.parent/'manifest.json').read_text())
tiles=set()
for scene in manifest['scenes'].values():
    lon,lat=scene['center'];n=2**13
    x=int((lon+180)/360*n);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    tiles.update((a,b) for a in range(x-3,x+4) for b in range(y-3,y+4))
with rasterio.open(ROOT/'data/seed/sochi/dem.tif') as source:
    for x,y in sorted(tiles):
        size=40075016.68557849/2**13
        left=x*size-20037508.342789244;top=20037508.342789244-y*size
        elevation=np.zeros((256,256),dtype=np.float32)
        reproject(rasterio.band(source,1),elevation,src_transform=source.transform,src_crs=source.crs,dst_transform=from_bounds(left,top-size,left+size,top,256,256),dst_crs='EPSG:3857',resampling=Resampling.bilinear,dst_nodata=0)
        encoded=np.round((np.maximum(elevation,0)+10000)*10).astype(np.uint32)
        rgb=np.stack([(encoded>>16)&255,(encoded>>8)&255,encoded&255],axis=-1).astype(np.uint8)
        path=OUT/f'13/{x}/{y}.png';path.parent.mkdir(parents=True,exist_ok=True);
        with rasterio.open(path,'w',driver='PNG',width=256,height=256,count=3,dtype='uint8') as target: target.write(rgb.transpose(2,0,1))
print(json.dumps({'tiles':len(tiles),'bytes':sum(p.stat().st_size for p in OUT.rglob('*.png')),'source':'Copernicus GLO-30','native_zoom':13}))
