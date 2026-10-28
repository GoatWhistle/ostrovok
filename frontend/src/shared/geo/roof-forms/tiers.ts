import { localFrame } from "../roof-mesh/frame"
import { isPitched } from "../roof-mesh/mesh"
import { type Position, toLocal } from "./footprint"

export interface RoofSource {
  readonly geometry: { readonly type: string; readonly coordinates: unknown[] }
  readonly properties: {
    readonly building_id: string
    readonly hotel_id: string | null
    readonly levels: number | null
    readonly render_height_m: number
  }
}

export type RoofKind = "pitched" | "flat" | "none"

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

export function roofKind(source: RoofSource): RoofKind {
  const { hotel_id: hotel, levels, render_height_m: height } = source.properties
  if (hotel || height <= 0) return "none"
  const ring = outerRing(source.geometry)
  const frame = ring ? localFrame(toLocal(ring).points) : undefined
  if (!frame) return "flat"
  return isPitched({ height, levels }, frame) ? "pitched" : "flat"
}
