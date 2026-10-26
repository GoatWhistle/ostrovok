import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"

const GLACIERS = "/data/glaciers.geojson"
const SNOW_LAYER = "snow-relief"
const GLACIER_LAYER = "glaciers"
const SNOW_START = 3300
const SNOW_FULL = 4000
const NEAR_FROM = 6.5
const NEAR_TO = 8.5
const GLACIER_OPACITY = 0.92

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  if (Number.isNaN(value)) return hex
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function snowRamp(snow: string): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    SNOW_START,
    rgba(snow, 0),
    SNOW_FULL,
    rgba(snow, 1),
  ]
}

const NEAR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  NEAR_FROM,
  0,
  NEAR_TO,
  1,
]
const FAR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  NEAR_FROM,
  GLACIER_OPACITY,
  NEAR_TO,
  0,
]

export function addSnowLayers(map: MapLibreMap, demSource: string, snow: string, before: string) {
  if (map.getLayer(SNOW_LAYER)) return
  map.addLayer(
    {
      id: SNOW_LAYER,
      type: "color-relief",
      source: demSource,
      paint: { "color-relief-color": snowRamp(snow), "color-relief-opacity": NEAR },
    },
    before,
  )
  map.addSource(GLACIER_LAYER, { type: "geojson", data: `${window.location.origin}${GLACIERS}` })
  map.addLayer(
    {
      id: GLACIER_LAYER,
      type: "fill",
      source: GLACIER_LAYER,
      paint: { "fill-color": snow, "fill-opacity": FAR, "fill-antialias": true },
    },
    before,
  )
}

export function paintSnow(map: MapLibreMap, snow: string) {
  if (!map.getLayer(SNOW_LAYER)) return
  map.setPaintProperty(SNOW_LAYER, "color-relief-color", snowRamp(snow))
  map.setPaintProperty(GLACIER_LAYER, "fill-color", snow)
}
