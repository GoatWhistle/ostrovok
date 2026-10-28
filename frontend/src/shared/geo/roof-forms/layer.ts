import type { Feature, FeatureCollection } from "geojson"
import type { ExpressionSpecification } from "maplibre-gl"
import { type RoofSource, roofKind } from "./tiers"

export const FLAT_ROOF: ExpressionSpecification = ["!", ["to-boolean", ["get", "pitched"]]]

export function withRoofForms<T extends RoofSource>(sources: readonly T[]) {
  return sources.map((source) => ({
    ...source,
    properties: { ...source.properties, pitched: roofKind(source) === "pitched" },
  }))
}

function contextSource(feature: Feature): RoofSource | undefined {
  const { geometry } = feature
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return undefined
  const properties = feature.properties ?? {}
  return {
    geometry,
    properties: {
      building_id: String(properties.id ?? feature.id ?? ""),
      hotel_id: properties.is_hotel ? "hotel" : null,
      levels: typeof properties.levels === "number" ? properties.levels : null,
      render_height_m: Number(properties.height_m) || 0,
    },
  }
}

export function contextRoofs(data: FeatureCollection): FeatureCollection {
  const features = data.features.map((feature) => {
    const source = contextSource(feature)
    const pitched = source ? roofKind(source) === "pitched" : false
    return { ...feature, properties: { ...feature.properties, pitched } }
  })
  return { ...data, features }
}
