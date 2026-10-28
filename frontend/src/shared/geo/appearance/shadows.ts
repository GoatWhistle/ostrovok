import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
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

const TYPICAL_HEIGHT_M = 7
const MAX_LENGTH_M = 24
const SHADOW_OPACITY = 0.14
const STEPS = [0.5, 1] as const
const MIN_ALTITUDE = 0.5
const CLEAR = "rgba(0, 0, 0, 0)"
const EARTH_CIRCUMFERENCE_M = 40075016.686
const FROM_ZOOM = 14
const TO_ZOOM = 20

export function shadowOffset(azimuth: number, altitude: number): [number, number] {
  if (altitude <= MIN_ALTITUDE) return [0, 0]
  const length = Math.min(MAX_LENGTH_M, TYPICAL_HEIGHT_M / Math.tan((altitude * Math.PI) / 180))
  const radians = ((azimuth + 180) * Math.PI) / 180
  return [
    Math.round(Math.sin(radians) * length * 10) / 10,
    Math.round(-Math.cos(radians) * length * 10) / 10,
  ]
}

function pixels(map: MapLibreMap, zoom: number): number {
  const latitude = (map.getCenter().lat * Math.PI) / 180
  return (512 * 2 ** zoom) / (EARTH_CIRCUMFERENCE_M * Math.cos(latitude))
}

function translate(
  map: MapLibreMap,
  [x, y]: readonly [number, number],
  share: number,
): ExpressionSpecification {
  const at = (zoom: number) => {
    const scale = pixels(map, zoom) * share
    const point = [Math.round(x * scale * 10) / 10, Math.round(y * scale * 10) / 10]
    return ["literal", point] as ExpressionSpecification
  }
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    FROM_ZOOM,
    at(FROM_ZOOM),
    TO_ZOOM,
    at(TO_ZOOM),
  ]
}

function renderShadow(
  map: MapLibreMap,
  shadow: (typeof SHADOWS)[number],
  color: string | undefined,
  offset: [number, number],
) {
  for (const share of STEPS) renderShadowStep(map, shadow, color, offset, share)
}

function renderShadowStep(
  map: MapLibreMap,
  shadow: (typeof SHADOWS)[number],
  color: string | undefined,
  offset: [number, number],
  share: number,
) {
  const id = share === 1 ? shadow.id : `${shadow.id}-near`
  if (!color) {
    if (map.getLayer(id)) map.removeLayer(id)
    return
  }
  if (!map.getSource(shadow.source) || !map.getLayer(shadow.owner)) return
  const filter = map.getFilter(shadow.owner)
  if (!map.getLayer(id)) {
    map.addLayer(
      {
        id,
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
  map.setPaintProperty(id, "fill-color", offset[0] || offset[1] ? color : CLEAR)
  map.setPaintProperty(id, "fill-translate", translate(map, offset, share))
  if (JSON.stringify(map.getFilter(id)) !== JSON.stringify(filter))
    map.setFilter(id, filter ?? null)
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
  if (!color || !map.getLayer("base-trees")) {
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
  map.setPaintProperty(TREE_SHADOW, "circle-color", x || y ? color : CLEAR)
  map.setPaintProperty(TREE_SHADOW, "circle-translate", translate(map, [x, y], TREE_SHADOW_SHARE))
}
