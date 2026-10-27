import type { Feature, FeatureCollection } from "geojson"
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"
import { pitchedRoof, type RoofSource } from "./tiers"

export const ROOF_FORMS = "scene-roof-forms"
export const CONTEXT_ROOF_FORMS = "context-roof-forms"
const LAYERS = [ROOF_FORMS, CONTEXT_ROOF_FORMS] as const
export const FLAT_ROOF: ExpressionSpecification = ["!", ["to-boolean", ["get", "pitched"]]]
const MIN_ZOOM = 16
const CONTEXT_MIN_ZOOM = 15

export function withRoofForms<T extends RoofSource>(sources: readonly T[]) {
  const roofs = sources.map((source) => pitchedRoof(source))
  const buildings = sources.map((source, index) => ({
    ...source,
    properties: { ...source.properties, pitched: (roofs[index]?.length ?? 0) > 0 },
  }))
  return { buildings, roofs: { type: "FeatureCollection", features: roofs.flat() } as const }
}

function exclusion(excluded: readonly string[]): FilterSpecification {
  return ["!", ["in", ["get", "building_id"], ["literal", [...excluded]]]]
}

export function renderRoofForms(
  map: MapLibreMap,
  roofs: FeatureCollection,
  excluded: readonly string[],
  id: (typeof LAYERS)[number] = ROOF_FORMS,
) {
  const source = map.getSource(id) as GeoJSONSource | undefined
  if (source) source.setData(roofs)
  else map.addSource(id, { type: "geojson", data: roofs })
  if (map.getLayer(id)) {
    map.setFilter(id, exclusion(excluded))
    return
  }
  map.addLayer(
    {
      id,
      type: "fill-extrusion",
      source: id,
      minzoom: id === ROOF_FORMS ? MIN_ZOOM : CONTEXT_MIN_ZOOM,
      filter: exclusion(excluded),
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": "#000000",
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "top"],
        "fill-extrusion-vertical-gradient": false,
        "fill-extrusion-opacity": 1,
      },
    },
    labelAnchor(map),
  )
}

export function paintRoofForms(map: MapLibreMap, colors: readonly string[], edge?: string) {
  for (const id of LAYERS) if (map.getLayer(id)) paintLayer(map, id, colors, edge)
}

function paintLayer(map: MapLibreMap, id: string, colors: readonly string[], edge?: string) {
  const [first] = colors
  map.setLayoutProperty(id, "visibility", first ? "visible" : "none")
  if (!first) return
  const color: ExpressionSpecification | string =
    colors.length === 1
      ? first
      : ([
          "match",
          ["%", ["get", "tone"], colors.length],
          ...colors.flatMap((value, index) => [index, value]),
          first,
        ] as unknown as ExpressionSpecification)
  map.setPaintProperty(
    id,
    "fill-extrusion-color",
    edge ? ["case", ["to-boolean", ["get", "edge"]], edge, color] : color,
  )
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

export function contextRoofs(data: FeatureCollection) {
  const roofs: Feature[] = []
  const features = data.features.map((feature) => {
    const source = contextSource(feature)
    const tiers = source ? pitchedRoof(source) : []
    roofs.push(...tiers)
    return { ...feature, properties: { ...feature.properties, pitched: tiers.length > 0 } }
  })
  return {
    buildings: { ...data, features } as FeatureCollection,
    roofs: { type: "FeatureCollection", features: roofs } as FeatureCollection,
  }
}
