import type { Map as MapLibreMap } from "maplibre-gl"

const SHADOWS = [
  {
    id: "toy-overview-shadow",
    owner: "overview-volumes",
    source: "sochi-map",
    layer: "buildings",
    min: 14,
    max: 16,
  },
  { id: "toy-scene-shadow", owner: "scene-volumes", source: "scene-buildings", min: 16, max: 24 },
  { id: "toy-context-shadow", owner: "buildings-volume", source: "buildings", min: 14, max: 24 },
] as const

const MAX_LENGTH = 34
const MIN_ALTITUDE = 4

export function shadowOffset(azimuth: number, altitude: number): [number, number] {
  if (altitude <= MIN_ALTITUDE) return [0, 0]
  const length = Math.min(MAX_LENGTH, 14 / Math.tan((altitude * Math.PI) / 180))
  const radians = ((azimuth + 180) * Math.PI) / 180
  return [
    Math.round(Math.sin(radians) * length * 10) / 10,
    Math.round(-Math.cos(radians) * length * 10) / 10,
  ]
}

function renderShadow(
  map: MapLibreMap,
  shadow: (typeof SHADOWS)[number],
  color: string | undefined,
  offset: [number, number],
) {
  if (!color || (offset[0] === 0 && offset[1] === 0)) {
    if (map.getLayer(shadow.id)) map.removeLayer(shadow.id)
    return
  }
  if (!map.getSource(shadow.source) || !map.getLayer(shadow.owner)) return
  const filter = map.getFilter(shadow.owner)
  if (!map.getLayer(shadow.id)) {
    map.addLayer(
      {
        id: shadow.id,
        type: "fill",
        source: shadow.source,
        ...("layer" in shadow ? { "source-layer": shadow.layer } : {}),
        minzoom: shadow.min,
        maxzoom: shadow.max,
        ...(filter ? { filter } : {}),
        paint: { "fill-color": color, "fill-opacity": 0.28, "fill-translate-anchor": "map" },
      },
      shadow.owner,
    )
  }
  map.setPaintProperty(shadow.id, "fill-color", color)
  map.setPaintProperty(shadow.id, "fill-translate", offset)
  if (JSON.stringify(map.getFilter(shadow.id)) !== JSON.stringify(filter))
    map.setFilter(shadow.id, filter ?? null)
}

export function renderGroundShadows(
  map: MapLibreMap,
  color: string | undefined,
  azimuth: number,
  altitude: number,
) {
  const offset = shadowOffset(azimuth, altitude)
  for (const shadow of SHADOWS) renderShadow(map, shadow, color, offset)
}
