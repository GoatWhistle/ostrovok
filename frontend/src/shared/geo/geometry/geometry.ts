import type { Feature, FeatureCollection, Geometry } from "geojson"

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function position(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  )
}
function coordinates(value: unknown, depth: number): boolean {
  return depth === 0
    ? position(value)
    : Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => coordinates(item, depth - 1))
}
const DEPTH: Readonly<Record<string, number>> = {
  Point: 0,
  MultiPoint: 1,
  LineString: 1,
  MultiLineString: 2,
  Polygon: 2,
  MultiPolygon: 3,
}
function line(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 2 && value.every(position)
}
function ring(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4 || !value.every(position)) return false
  return JSON.stringify(value[0]) === JSON.stringify(value[value.length - 1])
}
function polygon(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(ring)
}
export function validGeometry(value: unknown): value is Geometry {
  if (!record(value) || typeof value.type !== "string") return false
  const depth = DEPTH[value.type]
  if (depth === undefined || !coordinates(value.coordinates, depth)) return false
  if (value.type === "LineString") return line(value.coordinates)
  if (value.type === "MultiLineString")
    return Array.isArray(value.coordinates) && value.coordinates.every(line)
  if (value.type === "Polygon") return polygon(value.coordinates)
  if (value.type === "MultiPolygon")
    return Array.isArray(value.coordinates) && value.coordinates.every(polygon)
  return true
}

export function featureCollection(values: readonly unknown[]): FeatureCollection {
  const features: Feature[] = []
  for (const item of values) {
    if (!record(item) || item.type !== "Feature" || !validGeometry(item.geometry)) continue
    const feature: Feature = {
      type: "Feature",
      geometry: item.geometry,
      properties: record(item.properties) ? item.properties : {},
    }
    if (typeof item.id === "string" || typeof item.id === "number") feature.id = item.id
    features.push(feature)
  }
  return { type: "FeatureCollection", features }
}
