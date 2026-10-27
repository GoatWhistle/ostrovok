import type { Map as MapLibreMap } from "maplibre-gl"
import { IN_SCENE } from "../overview-buildings"

const SHADOWS = [
  {
    id: "toy-overview-shadow",
    owner: "overview-volumes",
    source: "sochi-map",
    layer: "buildings",
    min: 14,
    max: 24,
  },
  { id: "toy-scene-shadow", owner: "scene-volumes", source: "scene-buildings", min: 14, max: 24 },
  { id: "toy-context-shadow", owner: "buildings-volume", source: "buildings", min: 14, max: 24 },
] as const

const MAX_LENGTH = 34
const SHADOW_OPACITY = 0.28
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
        paint: {
          "fill-color": color,
          "fill-opacity": ["case", IN_SCENE, 0, SHADOW_OPACITY],
          "fill-translate-anchor": "map",
        },
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

const TREE_SHADOW = "base-trees-shadow"
const TREE_SHADOW_SHARE = 0.45

export function renderTreeShadows(
  map: MapLibreMap,
  color: string | undefined,
  azimuth: number,
  altitude: number,
) {
  const [x, y] = shadowOffset(azimuth, altitude)
  if (!color || !map.getLayer("base-trees") || (x === 0 && y === 0)) {
    if (map.getLayer(TREE_SHADOW)) map.removeLayer(TREE_SHADOW)
    return
  }
  if (!map.getLayer(TREE_SHADOW))
    map.addLayer(
      {
        id: TREE_SHADOW,
        type: "circle",
        source: "sochi-map",
        "source-layer": "trees",
        minzoom: 15,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.8, 19, 6],
          "circle-blur": 0.6,
          "circle-opacity": 0.3,
          "circle-pitch-alignment": "map",
          "circle-translate-anchor": "map",
        },
      },
      "base-trees",
    )
  map.setPaintProperty(TREE_SHADOW, "circle-color", color)
  map.setPaintProperty(TREE_SHADOW, "circle-translate", [
    x * TREE_SHADOW_SHARE,
    y * TREE_SHADOW_SHARE,
  ])
}
