import earcut from "earcut"
import type { Position } from "geojson"
import { MercatorCoordinate } from "maplibre-gl"
import type { TexturedFootprint } from "./selection"

type Point = readonly [number, number]

export interface BuildingMesh {
  readonly vertices: Float32Array
  readonly origin: readonly [number, number]
  readonly ground: number
}

function area(ring: readonly Point[]) {
  return ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length] ?? a
    return sum + a[0] * b[1] - b[0] * a[1]
  }, 0)
}

function projectedRing(ring: Position[], origin: MercatorCoordinate, clockwise: boolean): Point[] {
  const scale = origin.meterInMercatorCoordinateUnits()
  const points: Point[] = ring.slice(0, -1).map(([lon = 0, lat = 0]) => {
    const point = MercatorCoordinate.fromLngLat([lon, lat])
    return [(point.x - origin.x) / scale, (point.y - origin.y) / scale]
  })
  if (area(points) > 0 !== clockwise) points.reverse()
  return points
}

function addWalls(vertices: number[], ring: Point[], bottom: number, top: number) {
  let travelled = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    if (!a || !b) continue
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length < 0.001) continue
    const normal = [(b[1] - a[1]) / length, (a[0] - b[0]) / length, 0]
    const corners = [
      [a[0], a[1], bottom, travelled / 136, bottom / 51],
      [b[0], b[1], bottom, (travelled + length) / 136, bottom / 51],
      [b[0], b[1], top, (travelled + length) / 136, top / 51],
      [a[0], a[1], top, travelled / 136, top / 51],
    ]
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const corner = corners[index]
      if (corner) vertices.push(...corner.slice(0, 3), ...normal, ...corner.slice(3), 0)
    }
    travelled += length
  }
}

function addRoof(vertices: number[], rings: Point[][], top: number) {
  const points = rings.flat()
  const holes: number[] = []
  let count = rings[0]?.length ?? 0
  for (const ring of rings.slice(1)) {
    holes.push(count)
    count += ring.length
  }
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(...xs) - minX || 1
  const depth = Math.max(...ys) - minY || 1
  for (const index of earcut(points.flat(), holes, 2)) {
    const point = points[index]
    if (point)
      vertices.push(
        point[0],
        point[1],
        top,
        0,
        0,
        1,
        (point[0] - minX) / width,
        (point[1] - minY) / depth,
        1,
      )
  }
}

function polygonsOf(feature: TexturedFootprint) {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates
}

export function buildingMesh(features: readonly TexturedFootprint[]): BuildingMesh | undefined {
  const first = features[0]
  if (!first) return undefined
  const polygons = features.flatMap(polygonsOf)
  const [lon = 0, lat = 0] = polygons[0]?.[0]?.[0] ?? []
  const origin = MercatorCoordinate.fromLngLat([lon, lat])
  const vertices: number[] = []
  for (const feature of features) {
    const parts = polygonsOf(feature)
    const bottom = Math.max(0, Number(feature.properties?.min_height_m) || 0)
    const top = Number(feature.properties?.height_m)
    for (const polygon of parts) {
      const rings = polygon.map((ring, i) => projectedRing(ring, origin, i === 0))
      if (!rings[0] || Math.abs(area(rings[0])) < 0.01) continue
      for (const ring of rings) addWalls(vertices, ring, bottom, top)
      addRoof(vertices, rings, top)
    }
  }
  if (!vertices.length) return undefined
  return {
    vertices: new Float32Array(vertices),
    origin: [lon, lat],
    ground: Number(first.properties?.ground_elevation_m) || 0,
  }
}
