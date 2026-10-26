import concurrent.futures
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote

ROOT = Path(__file__).parent / 'shared'
ASSETS = {
 'vendor/maplibre-gl.mjs':'https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl.mjs',
 'vendor/maplibre-gl-worker.mjs':'https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl-worker.mjs',
 'vendor/maplibre-gl.css':'https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl.css',
 'vendor/maplibre-LICENSE.txt':'https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/LICENSE.txt',
 'vendor/pmtiles.js':'https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js',
 'vendor/pmtiles-LICENSE':'https://raw.githubusercontent.com/protomaps/PMTiles/main/LICENSE',
 'vendor/basemaps.js':'https://cdn.jsdelivr.net/npm/@protomaps/basemaps@5.7.2/dist/basemaps.js',
 'vendor/basemaps-LICENSE':'https://raw.githubusercontent.com/protomaps/basemaps/main/LICENSE.md',
 'vendor/three.module.js':'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js',
 'vendor/three.core.js':'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.core.js',
 'vendor/three-LICENSE':'https://cdn.jsdelivr.net/npm/three@0.186.1/LICENSE',
 'vendor/deck.js':'https://cdn.jsdelivr.net/npm/deck.gl@9.4.0/dist.min.js',
 'vendor/deck-LICENSE':'https://cdn.jsdelivr.net/npm/deck.gl@9.4.0/LICENSE',
 'vendor/contour.js':'https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.1/dist/index.min.js',
 'vendor/contour-LICENSE':'https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.1/LICENSE',
 'vendor/GLTFLoader.js':'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/loaders/GLTFLoader.js',
 'utils/SkeletonUtils.js':'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/utils/SkeletonUtils.js',
 'utils/BufferGeometryUtils.js':'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/utils/BufferGeometryUtils.js',
}

for font in ['Noto Sans Regular','Noto Sans Medium','Noto Sans Italic']:
    for start in [0,256,512,768,1024,1280,8192,8448]:
        ASSETS[f'fonts/{font}/{start}-{start+255}.pbf']=f'https://protomaps.github.io/basemaps-assets/fonts/{quote(font)}/{start}-{start+255}.pbf'
for theme in ['light','dark','black']:
    for suffix in ['.json','.png','@2x.json','@2x.png']:
        ASSETS[f'sprites/{theme}{suffix}']=f'https://protomaps.github.io/basemaps-assets/sprites/v4/{theme}{suffix}'


def fetch(item):
    name,url=item
    path=ROOT/name
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():return name,'cached'
    for attempt in range(2):
        try:
            with urlopen(url,timeout=40) as response:body=response.read()
            path.write_bytes(body)
            return name,len(body)
        except Exception as error:
            if attempt:return name,str(error)


if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(fetch,ASSETS.items()))
        for result in results:print(result,flush=True)
        if any(not isinstance(value,int) and value!='cached' for _,value in results):raise SystemExit('Some assets failed to download; see filenames above')
