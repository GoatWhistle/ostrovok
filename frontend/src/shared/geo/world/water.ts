import type { Map as MapLibreMap } from "maplibre-gl"
import { type WaterTier, waterLayers } from "./water-layers"

interface WaterColors {
  readonly sea: string
  readonly coast: string
}

const SWITCH_ZOOM = 5.5
const FAR: WaterTier = { id: "world-water-far", data: "/data/water-far.geojson" }
const NEAR: WaterTier = {
  id: "world-water-near",
  data: "/data/water-near.geojson",
  minzoom: SWITCH_ZOOM,
}
const NEAR_LOAD_FROM = 4.5
const NEAR_LOAD_TO = 10.5
const latest = new WeakMap<MapLibreMap, WaterColors>()

function addTier(map: MapLibreMap, tier: WaterTier, colors: WaterColors, before?: string) {
  map.addSource(tier.id, {
    type: "geojson",
    data: `${window.location.origin}${tier.data}`,
    maxzoom: 10,
  })
  for (const layer of waterLayers(tier, colors.sea, colors.coast)) map.addLayer(layer, before)
}

function layerAfter(map: MapLibreMap, id: string): string | undefined {
  const layers = map.getStyle().layers ?? []
  const index = layers.findIndex((layer) => layer.id === id)
  return index >= 0 ? layers[index + 1]?.id : undefined
}

function paintTier(map: MapLibreMap, tier: WaterTier, colors: WaterColors) {
  if (!map.getSource(tier.id)) return
  map.setPaintProperty(`${tier.id}-fill`, "fill-color", colors.sea)
  map.setPaintProperty(`${tier.id}-coast`, "line-color", colors.coast)
  map.setPaintProperty(`${tier.id}-seam`, "line-color", colors.sea)
}

function handOverToNear(map: MapLibreMap) {
  const ready = () => {
    if (!map.isSourceLoaded(NEAR.id)) return
    map.off("sourcedata", ready)
    for (const layer of waterLayers(FAR, "", ""))
      map.setLayerZoomRange(layer.id, 0, Math.min(layer.maxzoom ?? SWITCH_ZOOM, SWITCH_ZOOM))
  }
  map.on("sourcedata", ready)
}

function loadNearWhenNeeded(map: MapLibreMap) {
  const load = () => {
    const colors = latest.get(map)
    const zoom = map.getZoom()
    if (zoom < NEAR_LOAD_FROM || zoom > NEAR_LOAD_TO || !colors || map.getSource(NEAR.id)) return
    map.off("zoom", load)
    addTier(map, NEAR, colors, layerAfter(map, `${FAR.id}-seam`))
    handOverToNear(map)
  }
  map.on("zoom", load)
  load()
}

export function renderWorldWater(map: MapLibreMap, sea: string, coast: string) {
  const colors = { sea, coast }
  const first = !latest.has(map)
  latest.set(map, colors)
  if (!map.getSource(FAR.id)) addTier(map, FAR, colors)
  if (first) loadNearWhenNeeded(map)
  paintTier(map, FAR, colors)
  paintTier(map, NEAR, colors)
}
