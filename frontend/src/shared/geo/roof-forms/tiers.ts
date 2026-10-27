import type { Feature, FeatureCollection, Polygon } from "geojson"
import { insetRing, type Position, type RoofFrame, roofFrame } from "./footprint"

export interface RoofSource {
  readonly geometry: { readonly type: string; readonly coordinates: unknown[] }
  readonly properties: {
    readonly building_id: string
    readonly hotel_id: string | null
    readonly levels: number | null
    readonly render_height_m: number
  }
}

export type RoofShape = "gable" | "hip"

const STEPS = 6
const MAX_HEIGHT = 16
const MAX_LEVELS = 5
const MIN_AREA = 25
const MAX_AREA = 900
const MIN_RECTANGULARITY = 0.78
const PITCH = 0.62
const MAX_RISE = 4.5
const MAX_BLOCK_AREA = 6000
const PARAPET_WIDTH = 0.6
const PARAPET_HEIGHT = 0.9
const DECK_HEIGHT = 0.3
const DECK_GAP = 0.004

function seed(id: string): number {
  let value = 0
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

export function roofShape(id: string, frame: RoofFrame): RoofShape {
  if (frame.length / frame.width > 2.6) return "gable"
  return seed(id) % 5 < 2 ? "hip" : "gable"
}

function outerRing(geometry: RoofSource["geometry"]): Position[] | undefined {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates as Position[][][])
        : []
  if (polygons.length !== 1) return undefined
  const [ring, ...holes] = polygons[0] ?? []
  return holes.length === 0 ? ring : undefined
}

function mutable(ring: readonly Position[]): [number, number][] {
  return ring.map(([x, y]) => [x, y])
}

function flatRoof(id: string, ring: Position[], frame: RoofFrame, height: number) {
  const along = 1 - (2 * PARAPET_WIDTH) / frame.length
  const across = 1 - (2 * PARAPET_WIDTH) / frame.width
  if (along <= 0.5 || across <= 0.5) return []
  const hole = insetRing(ring, frame, along, across)
  const deck = insetRing(ring, frame, along - DECK_GAP, across - DECK_GAP)
  const tone = seed(id)
  const parapet: Feature<Polygon> = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [mutable(ring), mutable(hole).reverse()] },
    properties: { building_id: id, tone, edge: true, base: height, top: height + PARAPET_HEIGHT },
  }
  const roof: Feature<Polygon> = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [mutable(deck)] },
    properties: { building_id: id, tone, flat: true, base: height, top: height + DECK_HEIGHT },
  }
  return [parapet, roof]
}

export function pitchedRoof(source: RoofSource): Feature<Polygon>[] {
  const { building_id: id, hotel_id: hotel, levels, render_height_m: height } = source.properties
  if (hotel || height <= 0) return []
  const ring = outerRing(source.geometry)
  if (!ring) return []
  const frame = roofFrame(ring)
  const area = frame ? frame.length * frame.width * frame.rectangularity : 0
  if (!frame || area < MIN_AREA || frame.rectangularity < MIN_RECTANGULARITY) return []
  const tall = height > MAX_HEIGHT || (levels ?? 0) > MAX_LEVELS || area > MAX_AREA
  if (tall) return area <= MAX_BLOCK_AREA ? flatRoof(id, ring, frame, height) : []
  const shape = roofShape(id, frame)
  const rise = Math.min(MAX_RISE, (frame.width / 2) * PITCH)
  const step = rise / STEPS
  const tone = seed(id)
  return Array.from({ length: STEPS }, (_, index) => {
    const across = 1 - index / STEPS
    const inset = (frame.width * (1 - across)) / 2
    const along = shape === "hip" ? Math.max(0.05, 1 - (2 * inset) / frame.length) : 1
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [mutable(insetRing(ring, frame, along, across))],
      },
      properties: {
        building_id: id,
        tone,
        base: height + index * step,
        top: height + (index + 1) * step,
      },
    }
  })
}

export function roofCollection(sources: readonly RoofSource[]): FeatureCollection<Polygon> {
  return { type: "FeatureCollection", features: sources.flatMap(pitchedRoof) }
}
