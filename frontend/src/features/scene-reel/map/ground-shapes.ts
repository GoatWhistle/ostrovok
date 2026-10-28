import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
import { type Coordinates, HOTEL, QUIET_METERS, ring } from "../shots"

const SOURCE = "reel-ground"
const FILL = "reel-ground-fill"
const EDGE = "reel-ground-edge"
const RING_STEPS = 64
const STEP = 0.02

export interface GroundState {
  readonly calm: number
  readonly calmFade: number
}

interface Shape {
  readonly ring: Coordinates[]
  readonly color: string
  readonly opacity: number
  readonly edge: boolean
}

function calm(state: GroundState, color: string): Shape[] {
  if (state.calm <= 0) return []
  const meters = Math.max(1, QUIET_METERS * state.calm)
  return [
    { ring: ring(HOTEL, meters, RING_STEPS), color, opacity: 0.07, edge: true },
    { ring: ring(HOTEL, meters * 0.5, RING_STEPS), color, opacity: 0.08, edge: false },
  ].map((shape) => ({ ...shape, opacity: shape.opacity * state.calmFade }))
}

function ensure(map: MapLibreMap) {
  if (map.getSource(SOURCE)) return true
  if (!map.getStyle()) return false
  const before = map.getStyle().layers.find((layer) => layer.type === "fill-extrusion")?.id
  map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  map.addLayer(
    {
      id: FILL,
      type: "fill",
      source: SOURCE,
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
    },
    before,
  )
  map.addLayer(
    {
      id: EDGE,
      type: "line",
      source: SOURCE,
      filter: ["==", ["get", "edge"], true],
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": ["*", ["get", "opacity"], 3],
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 1.6],
      },
    },
    before,
  )
  return true
}

const painted = new WeakMap<MapLibreMap, string>()
const step = (value: number) => Math.round(value / STEP) * STEP

export function paintGround(map: MapLibreMap, state: GroundState, quiet: string) {
  if (!ensure(map)) return
  const quantized: GroundState = { calm: step(state.calm), calmFade: step(state.calmFade) }
  const key = `${Object.values(quantized).join(":")}:${quiet}`
  if (painted.get(map) === key) return
  painted.set(map, key)
  const shapes = calm(quantized, quiet)
  map.getSource<GeoJSONSource>(SOURCE)?.setData({
    type: "FeatureCollection",
    features: shapes.map((shape) => ({
      type: "Feature",
      properties: { color: shape.color, opacity: shape.opacity, edge: shape.edge },
      geometry: { type: "Polygon", coordinates: [shape.ring.map(([lon, lat]) => [lon, lat])] },
    })),
  })
}
