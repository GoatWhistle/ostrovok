# Map prototype libraries and downloads

Checked 2026-10-26. These are implementation notes for the five disposable map prototypes. No application dependencies were changed. HTTP checks fetched metadata or small files; no planet archive was downloaded.

## Use the pinned APIs, because current docs differ

| Component | Pin | License | Browser artifact / finding |
| --- | --- | --- | --- |
| MapLibre GL JS | 6.15.0 | BSD-3-Clause | `https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl.mjs` and `maplibre-gl-worker.mjs`: HTTP 200. The old `maplibre-gl.js` path returns 404. |
| PMTiles | 4.5.0 | BSD-3-Clause | `https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js`: HTTP 200; global `pmtiles` |
| Protomaps basemaps | 5.7.2 | BSD-3-Clause | `https://cdn.jsdelivr.net/npm/@protomaps/basemaps@5.7.2/dist/basemaps.js`: HTTP 200; global `basemaps` |
| three.js | 0.186.1 | MIT | `https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js` and sibling `three.core.js`: HTTP 200 |
| deck.gl | 9.4.0 | MIT | `https://cdn.jsdelivr.net/npm/deck.gl@9.4.0/dist.min.js`: HTTP 200; includes both `MapLibreOverlay` and `MapboxOverlay` |
| maplibre-contour | 0.1.1 | BSD-3-Clause | `https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.1/dist/index.min.js`; global `mlcontour` |

Versions and license identifiers were read from publisher npm metadata: [MapLibre](https://registry.npmjs.org/maplibre-gl/6.15.0), [PMTiles](https://registry.npmjs.org/pmtiles/4.5.0), [basemaps](https://registry.npmjs.org/@protomaps/basemaps/5.7.2), [three.js](https://registry.npmjs.org/three/0.186.1), [deck.gl](https://registry.npmjs.org/deck.gl/9.4.0), [contour](https://registry.npmjs.org/maplibre-contour/0.1.1). Copy the package LICENSE files alongside vendored bundles. These pins are a reproducible starting point, not a claim that every combination has been browser-tested here.

MapLibre 6 requires ESM and an explicit worker URL. A standalone module can import the pinned `.mjs` and call `setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs', import.meta.url).href)`. Keep worker and library versions equal. Its CSS is `dist/maplibre-gl.css`.

The **tagged 6.15.0 source** declares `render(gl, options)` for custom layers. Use `options.defaultProjectionData.mainMatrix` for Mercator coordinates. Current unversioned docs show a newer single-object callback, which must not be copied into this pinned prototype. `onAdd(map, gl)` creates the Three renderer against the same canvas/context; disable `autoClear`, reset Three GL state before rendering, and dispose resources on removal. Preallocate matrices outside the frame callback. [Pinned CustomLayerInterface source](https://github.com/maplibre/maplibre-gl-js/blob/v6.15.0/src/style/style_layer/custom_style_layer.ts), [current API](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/).

For Three instancing, share one geometry/material per type, set instance transforms, then mark `instanceMatrix.needsUpdate`. Recompute bounds if transforms change. Multiple materials or separate meshes inside a GLTF model may still require more than one draw call; “one draw call per model” needs flattening/atlas work, not just InstancedMesh. [InstancedMesh API](https://threejs.org/docs/pages/InstancedMesh.html).

## Protomaps downloads and local assets

The builds UI gets JSON from `https://build-metadata.protomaps.dev/builds.json`, sorts by `key` descending, and forms archive URLs as `https://build.protomaps.com/{key}`. This was verified from its [published builds-page script](https://maps.protomaps.com/assets/builds-Cdq4B9B1.js). A plain Python request returned 403; adding browser User-Agent, Origin and Referer headers succeeded. The actual current key is **20261026.pmtiles**, tileset version **4.15.2**, uploaded **2026-10-26T09:00:37.168Z**. `https://build.protomaps.com/20261026.pmtiles` returned HTTP **206** for a 127-byte Range GET and the `PMTiles` v3 header. Record this key and download time in the manifest. The archive is 139188276062 bytes; its full-file BLAKE3 `04c16708f8e3723538fce26ca6b11e9c473c0a78966e796dd6290a59c62f103a` does not verify a subset extract. [Builds](https://maps.protomaps.com/builds/), [download documentation](https://docs.protomaps.com/basemaps/downloads).

The official CLI latest release queried here is **go-pmtiles v1.31.2**. Linux x86_64:
`https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz`.

Bounded download command:

```bash
pmtiles extract "$ARCHIVE_URL" data/raw/sochi-basemap.pmtiles --bbox=39.55,43.35,40.0,43.75 --maxzoom=15 --download-threads=4
```

`extract` requests a spatial subset from a clustered remote archive; the entire planet is not needed. Run `pmtiles verify` and save `pmtiles show --header-json` and `--metadata` output. Do not use a plain download command against the 120+ GB archive. [CLI](https://docs.protomaps.com/pmtiles/cli), [release](https://github.com/protomaps/go-pmtiles/releases/tag/v1.31.2).

Official mirror: `https://data.source.coop/protomaps/openstreetmap/v4.pmtiles`. It is an older build and must be labelled accordingly. A HEAD request here returned 403, so it is not yet an established working fallback. [Publisher's mirror page](https://source.coop/protomaps/openstreetmap/v4.pmtiles).

Browser setup: register `new pmtiles.Protocol().tile` using MapLibre `addProtocol('pmtiles', ...)`; vector source URL is `pmtiles://` followed by an absolute HTTP URL. For a simple Python server without HTTP Range support, either implement range serving or expose tiles from `pmtiles serve`; do not assume `python -m http.server` supplies efficient PMTiles ranges. [PMTiles MapLibre guide](https://docs.protomaps.com/pmtiles/maplibre).

Protomaps v4 tiles are compatible with basemaps style package v4+. Use `basemaps.layers('protomaps', basemaps.namedFlavor('light'), {lang:'ru'})`. Other flavors are dark, white, black and grayscale. Local glyph/sprite paths replace the defaults:

- `https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf`
- `https://protomaps.github.io/basemaps-assets/sprites/v4/light` (the style requests `.json`, `.png`, and high-DPR variants)
- [Asset repository](https://github.com/protomaps/basemaps-assets) offers ZIP distributions. Keep Cyrillic ranges and the exact font names referenced by the style.

The data is an ODbL Produced Work requiring OpenStreetMap attribution; library code licensing does not replace it. [Basemap setup and assets](https://docs.protomaps.com/basemaps/maplibre), [data terms](https://docs.protomaps.com/basemaps/downloads).

## deck.gl integration and shadows

For **deck.gl 9.4 with MapLibre v6**, use `MapLibreOverlay` from `@deck.gl/maplibre`, not the old MapboxOverlay in the draft spec. The standalone deck bundle includes that export. `interleaved:true` shares MapLibre's WebGL2 depth buffer; `beforeId` controls placement relative to MapLibre layers. [Current integration guide](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre), [publisher package](https://registry.npmjs.org/@deck.gl/maplibre/9.4.0).

Use SolidPolygonLayer with geographic polygon rings, `extruded:true`, `getElevation` from measured/estimated height metadata, and a LightingEffect containing AmbientLight and SunLight. SunLight takes a timestamp; its `_shadow:true` flag is **experimental**. A layer can disable shadow participation with `shadowEnabled:false`. Shadows affect deck geometries; do not claim MapLibre ground receives them unless a deck ground surface is present and verified. [Effects guide](https://deck.gl/docs/developer-guide/using-effects), [SolidPolygonLayer](https://deck.gl/docs/api-reference/layers/solid-polygon-layer).

## Contours from the existing DEM

The correct repository is [onthegomap/maplibre-contour](https://github.com/onthegomap/maplibre-contour), not maplibre/maplibre-contour. Version 0.1.1 remains BSD-3-Clause, with ISC/MIT-derived components noted in its README.

Construct `mlcontour.DemSource` with the existing DEM tile URL, **`encoding:'mapbox'`** (the plugin default is terrarium), `worker:true`, bounded cache and the DEM's real maxzoom. Call `setupMaplibre`, then add a vector source from `contourProtocolUrl({thresholds:{11:[200,1000],14:[50,200],15:[20,100]},contourLayer:'contours',elevationKey:'ele',levelKey:'level'})`. It fetches neighboring DEM tiles to join isolines; an offline tile slice must include that margin. The same decoded source can back `raster-dem` through `sharedDemProtocolUrl`. [Publisher README/API example](https://github.com/onthegomap/maplibre-contour/blob/main/README.md).

## Kenney assets

The following ZIP links were extracted from official free-download links; no account or payment is needed. All four official pack pages state CC0. Keep the included license, record filenames, count actual triangles, and label decorative scattering separately from mapped OSM trees/objects.

| Pack | Official page | ZIP |
| --- | --- | --- |
| Nature Kit | [330 models, CC0](https://kenney.nl/assets/nature-kit) | `https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip` |
| Watercraft Kit | [45 models, CC0](https://kenney.nl/assets/watercraft-kit) | `https://kenney.nl/media/pages/assets/watercraft-kit/a335cfed49-1713519620/kenney_watercraft-pack.zip` |
| City Kit Suburban | [official page](https://kenney.nl/assets/city-kit-suburban) | `https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip` |
| Holiday Kit | [official page](https://kenney.nl/assets/holiday-kit) | `https://kenney.nl/media/pages/assets/holiday-kit/3976a6496a-1733923970/kenney_holiday-kit.zip` |

Actual model names, triangle counts, common texture-atlas compatibility and availability of every desired prop were not inspected in this research pass. Select after listing ZIP contents. A missing exact prop should remain a documented omission rather than being represented as a real mapped object.

Availability note: two subsequent 127-byte Range probes using plain Python and Go-style user agents timed out during the TLS handshake. The browser-header probe succeeded once; this does not establish a header requirement or reliable availability. Use bounded retries and record fallback if extraction remains unreachable.

## Implemented corrections

SunCalc 2.1.1 and Manrope 5.3.0 are copied from the installed application packages. deck.gl standalone exports `_SunLight`, while its official guide calls the class SunLight. The pinned Three GLTFLoader also imports SkeletonUtils, included with its MIT license. Texture palettes in the selected Kenney models are baked into vertex colors; procedural umbrella/lounge geometry supplements the CC0 inventory. Libraries are vendored for offline viewing instead of runtime CDN requests.
