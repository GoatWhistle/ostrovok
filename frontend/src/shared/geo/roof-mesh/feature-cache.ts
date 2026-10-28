import type { GeoJSONFeature, Map as MapLibreMap } from "maplibre-gl"

const FRESH_MS = 400

interface Entry {
  readonly at: number
  readonly key: string
  readonly features: GeoJSONFeature[]
}

const cache = new WeakMap<MapLibreMap, Map<string, Entry>>()

function viewKey(map: MapLibreMap): string {
  const center = map.getCenter()
  return `${center.lng.toFixed(5)}:${center.lat.toFixed(5)}:${map.getZoom().toFixed(2)}`
}

export function sourceFeatures(map: MapLibreMap, sourceLayer: string): GeoJSONFeature[] {
  const layers = cache.get(map) ?? new Map<string, Entry>()
  cache.set(map, layers)
  const now = performance.now()
  const key = viewKey(map)
  const hit = layers.get(sourceLayer)
  if (hit && hit.key === key && now - hit.at < FRESH_MS) return hit.features
  const features = map.querySourceFeatures("sochi-map", { sourceLayer })
  layers.set(sourceLayer, { at: now, key, features })
  return features
}
