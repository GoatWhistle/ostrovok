import type { FeatureCollection } from "geojson"

function collect(value: unknown, points: [number, number][]) {
  if (!Array.isArray(value)) return
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    points.push([value[0], value[1]])
    return
  }
  value.forEach((item) => {
    collect(item, points)
  })
}

export function geometryBounds(
  features: FeatureCollection,
  center: readonly number[] | undefined,
): [[number, number], [number, number]] | null {
  const points: [number, number][] = []
  features.features.forEach((feature) => {
    if ("coordinates" in feature.geometry) collect(feature.geometry.coordinates, points)
  })
  if (center?.length === 2 && center.every(Number.isFinite))
    points.push([center[0] ?? 0, center[1] ?? 0])
  if (!points.length) return null
  return [
    [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1]))],
    [Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1]))],
  ]
}
