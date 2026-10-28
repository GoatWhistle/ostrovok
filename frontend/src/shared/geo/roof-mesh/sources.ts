import { LngLat, type Map as MapLibreMap } from "maplibre-gl"
import { sourceFeatures } from "./feature-cache"
import type { RoofInput } from "./mesh"

type LonLat = readonly [number, number]
type Ring = readonly LonLat[]

export interface RoofCandidate {
  readonly id: string
  readonly geometry: { readonly type: string; readonly coordinates: unknown }
  readonly height: number
  readonly levels: number | null
  readonly solid: boolean
}

const ESTIMATED_HEIGHT_M = 6.4
const MAX_ROOFS = 4500

function outerRings(geometry: RoofCandidate["geometry"]): Ring[] {
  if (geometry.type === "Polygon") return [(geometry.coordinates as Ring[])[0] ?? []]
  if (geometry.type === "MultiPolygon")
    return (geometry.coordinates as Ring[][]).map((polygon) => polygon[0] ?? [])
  return []
}

export function isSolid(geometry: RoofCandidate["geometry"]): boolean {
  if (geometry.type === "Polygon") return (geometry.coordinates as Ring[]).length === 1
  const polygons = geometry.coordinates as Ring[][]
  return geometry.type === "MultiPolygon" && polygons.length === 1 && polygons[0]?.length === 1
}

function centroid(ring: Ring): LonLat {
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x / ring.length
    lat += y / ring.length
  }
  return [lon, lat]
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null
}

export function tileCandidates(map: MapLibreMap, skip: ReadonlySet<string>): RoofCandidate[] {
  const pieces = new Map<string, RoofCandidate[]>()
  for (const feature of sourceFeatures(map, "buildings")) {
    const id = String(feature.properties.id ?? feature.id ?? "")
    if (!id || skip.has(id)) continue
    const list = pieces.get(id) ?? []
    list.push({
      id,
      geometry: feature.geometry as RoofCandidate["geometry"],
      height: number(feature.properties.height_m) ?? ESTIMATED_HEIGHT_M,
      levels: number(feature.properties.levels),
      solid: isSolid(feature.geometry as RoofCandidate["geometry"]),
    })
    pieces.set(id, list)
  }
  return [...pieces.values()].flatMap((list) => {
    const [first, ...rest] = list
    if (!first) return []
    if (rest.length === 0) return [first]
    const coordinates = list.flatMap((item) => outerRings(item.geometry).map((ring) => [ring]))
    const solid = list.every((item) => item.solid)
    return [{ ...first, solid, geometry: { type: "MultiPolygon", coordinates } }]
  })
}

function largest(rings: readonly Ring[]): Ring | undefined {
  let best: Ring | undefined
  let size = -1
  for (const ring of rings) {
    let area = 0
    for (let index = 0; index + 1 < ring.length; index += 1) {
      const [x1, y1] = ring[index] ?? [0, 0]
      const [x2, y2] = ring[index + 1] ?? [0, 0]
      area += x1 * y2 - x2 * y1
    }
    if (Math.abs(area) > size) {
      size = Math.abs(area)
      best = ring
    }
  }
  return best
}

function drawnGround(map: MapLibreMap, [lon, lat]: LonLat): number {
  const drawn = map.getTerrain()
    ? map.terrain?.getDrawnElevationForLngLat(new LngLat(lon, lat))
    : undefined
  return drawn ?? map.queryTerrainElevation([lon, lat]) ?? 0
}

export function roofInputs(
  map: MapLibreMap,
  candidates: readonly RoofCandidate[],
  center: LonLat,
): RoofInput[] {
  const scale = Math.cos((center[1] * Math.PI) / 180)
  const placed = candidates.flatMap((candidate) => {
    const rings = outerRings(candidate.geometry)
    const ring = largest(rings)
    if (!ring || ring.length < 4) return []
    const middle = centroid(ring)
    const ground = drawnGround(map, middle)
    const distance = Math.hypot((middle[0] - center[0]) * scale, middle[1] - center[1])
    const extra = rings.length > 1 ? rings.filter((item) => item !== ring).flat() : []
    return [{ candidate, ring, rings, extra, ground, distance }]
  })
  placed.sort((left, right) => left.distance - right.distance)
  return placed.slice(0, MAX_ROOFS).map(({ candidate, ring, rings, extra, ground }) => ({
    id: candidate.id,
    ring,
    extra,
    height: candidate.height,
    levels: candidate.levels,
    bodies: candidate.solid ? rings : [],
    ground,
  }))
}
