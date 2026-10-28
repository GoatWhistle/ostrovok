import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
import { type Coordinates, HOTEL, offset, QUIET_METERS, ring, SUNSET_AZIMUTH } from "../shots"

const SOURCE = "reel-ground"
const FILL = "reel-ground-fill"
const EDGE = "reel-ground-edge"
const ARC_STEPS = 10
const RING_STEPS = 64
const GLITTER_FROM = 260
const GLITTER_TO = 700
const GLITTER_DEGREES = 4
const CORE_DEGREES = 1.4
const STEP = 0.02

export interface GroundState {
  readonly glitter: number
  readonly glitterFade: number
  readonly calm: number
  readonly calmFade: number
}

interface Shape {
  readonly ring: Coordinates[]
  readonly color: string
  readonly opacity: number
  readonly edge: boolean
}

function band(from: number, to: number, degrees: number): Coordinates[] {
  const arc = (meters: number, sign: number) =>
    Array.from({ length: ARC_STEPS + 1 }, (_, step) =>
      offset(HOTEL, SUNSET_AZIMUTH + sign * degrees * (1 - (2 * step) / ARC_STEPS), meters),
    )
  const near = arc(from, 1)
  return [...near, ...arc(to, -1), near[0] ?? HOTEL]
}

function glitter(state: GroundState, color: string, strength: number): Shape[] {
  if (state.glitter <= 0) return []
  const to = GLITTER_FROM + (GLITTER_TO - GLITTER_FROM) * state.glitter
  return [
    { ring: band(GLITTER_FROM, to, GLITTER_DEGREES), color, opacity: 0.2, edge: false },
    { ring: band(GLITTER_FROM, to, CORE_DEGREES), color, opacity: 0.32, edge: false },
  ].map((shape) => ({ ...shape, opacity: shape.opacity * state.glitterFade * strength }))
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

export interface GroundColors {
  readonly glow: string
  readonly strength: number
  readonly quiet: string
}

export function paintGround(map: MapLibreMap, state: GroundState, colors: GroundColors) {
  const { glow, strength, quiet } = colors
  if (!ensure(map)) return
  const quantized: GroundState = {
    glitter: step(state.glitter),
    glitterFade: step(state.glitterFade),
    calm: step(state.calm),
    calmFade: step(state.calmFade),
  }
  const key = `${Object.values(quantized).join(":")}:${glow}:${strength}:${quiet}`
  if (painted.get(map) === key) return
  painted.set(map, key)
  const shapes = [...glitter(quantized, glow, strength), ...calm(quantized, quiet)]
  map.getSource<GeoJSONSource>(SOURCE)?.setData({
    type: "FeatureCollection",
    features: shapes.map((shape) => ({
      type: "Feature",
      properties: { color: shape.color, opacity: shape.opacity, edge: shape.edge },
      geometry: { type: "Polygon", coordinates: [shape.ring.map(([lon, lat]) => [lon, lat])] },
    })),
  })
}
