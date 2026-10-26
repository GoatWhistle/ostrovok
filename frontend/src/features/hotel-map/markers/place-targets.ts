import type { Feature } from "geojson"
import { placeName, walkLabel } from "@/entities/place"
import { featureCollection } from "@/shared/geo/geometry"
import type { Locale } from "@/shared/i18n"

function poiId(feature: Feature): string | undefined {
  return String(feature.id).match(/^g_poi_([nwr]\d+)$/)?.[1]
}

function routeLabel(feature: Feature, fallback: string | undefined, locale: Locale) {
  const props = feature.properties ?? {}
  return typeof props.distance_m === "number"
    ? walkLabel(props.minutes, props.distance_m, locale)
    : fallback
}

function target(
  feature: Feature,
  features: readonly Feature[],
  fallback: string | undefined,
  locale: Locale,
) {
  const props = feature.properties ?? {}
  const geometry = feature.geometry
  if (geometry.type !== "Point" && geometry.type !== "LineString") return undefined
  const route = geometry.type === "LineString"
  const position = (route ? geometry.coordinates.at(-1) : geometry.coordinates) as
    | [number, number]
    | undefined
  if (!position) return undefined
  const placeId =
    poiId(feature) ?? (typeof props.place_id === "string" ? props.place_id : undefined)
  const poi = features.find((item) => item.id === `g_poi_${placeId}`)
  const name = placeName(poi?.properties?.name ?? props.name, "place", locale)
  const label = route ? routeLabel(feature, fallback, locale) : name
  if (!label) return undefined
  return {
    kind: route ? ("route" as const) : ("place" as const),
    label,
    position,
    placeId,
    ariaLabel: placeId && route ? `${name}: ${label}` : label,
  }
}

export function placeTargets(
  values: readonly unknown[],
  fallback: string | undefined,
  locale: Locale,
) {
  const features = featureCollection(values).features
  const routes = features
    .filter(
      (feature) => feature.geometry.type === "LineString" && feature.properties?.kind === "route",
    )
    .sort((a, b) => Number(a.properties?.distance_m ?? 0) - Number(b.properties?.distance_m ?? 0))
  const linked = new Set(routes.map((route) => route.properties?.place_id).filter(Boolean))
  return features.flatMap((feature) => {
    const point = feature.geometry.type === "Point"
    const route = routes.includes(feature)
    if ((!point && !route) || (point && linked.has(poiId(feature)))) return []
    const view = target(feature, features, fallback, locale)
    return view ? [{ ...view, quiet: route && routes.indexOf(feature) >= 2 }] : []
  })
}
