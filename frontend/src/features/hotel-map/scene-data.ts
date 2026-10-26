import type {
  Camera,
  FactBrief,
  GeoFeatureCollection,
  HotelScene,
  MatchedProperty,
  SearchResult,
} from "@/shared/api/hotel-types"
import { factLabel, matchedExplanation, matchedTitle } from "@/shared/geo/fact-label"
import { featureCollection } from "@/shared/geo/geometry"
import type { Locale } from "@/shared/i18n"

const OVERVIEW_ZOOM_STEP = 1.8
const OVERVIEW_PITCH = 56
const OVERVIEW_BEARING = 38
const OVERVIEW_SHIFT_METERS = 2600
const METERS_PER_DEGREE = 111320

export function regionOverview(camera: Camera | undefined): Camera | undefined {
  const [lon, lat] = camera?.center ?? []
  if (!camera || lon === undefined || lat === undefined) return camera
  const angle = (OVERVIEW_BEARING * Math.PI) / 180
  const north = (OVERVIEW_SHIFT_METERS * Math.cos(angle)) / METERS_PER_DEGREE
  const east =
    (OVERVIEW_SHIFT_METERS * Math.sin(angle)) /
    (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  return {
    ...camera,
    center: [lon + east, lat + north],
    zoom: camera.zoom + OVERVIEW_ZOOM_STEP,
    pitch: OVERVIEW_PITCH,
    bearing: OVERVIEW_BEARING,
  }
}

export function sceneData(
  scene: HotelScene | undefined,
  camera: Camera | undefined,
  region: Camera | undefined,
  geometry: GeoFeatureCollection | undefined,
  results: readonly SearchResult[],
) {
  const selectedCamera = camera ?? scene?.cameras.best_match ?? scene?.cameras.overview ?? region
  const buildings = [
    ...(!scene
      ? results
          .map((result) => result.footprint)
          .filter((item) => item !== null && item !== undefined)
      : []),
    ...(scene?.context_buildings?.features ?? []),
    ...(scene?.building.features ?? []),
  ]
  const focus = selectedCamera?.focus_facade_id
  const facades = focus ? (scene?.facades?.filter((facade) => facade.id === focus) ?? []) : []
  const highlights = [
    ...(geometry?.features ?? []),
    ...facades.map((facade) => ({
      type: "Feature",
      geometry: facade.geometry,
      properties: { kind: "fact" },
    })),
  ]
  return { selectedCamera, buildings, highlights }
}
export function sceneQuality(
  buildings: readonly {
    properties?: { height_m?: number; is_hotel?: boolean; height_estimated?: boolean }
  }[],
  highlights: readonly unknown[],
) {
  return {
    invalid:
      featureCollection(buildings).features.length < buildings.length ||
      featureCollection(highlights).features.length < highlights.length,
    missingHeight: buildings.some(
      (building) =>
        Boolean(building?.properties?.height_estimated) ||
        Boolean(building?.properties?.is_hotel && !building.properties.height_m),
    ),
  }
}

export function resultCorners(
  results: readonly SearchResult[],
): [[number, number], [number, number]] | undefined {
  const points = results
    .map((result) => result.hotel.location)
    .filter((point) => point.length >= 2 && point.every(Number.isFinite))
  if (!points.length) return undefined
  const lons = points.map((point) => point[0] ?? 0)
  const lats = points.map((point) => point[1] ?? 0)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

export function focusCopy(
  property: MatchedProperty | undefined,
  fact: FactBrief | undefined,
  hasFeatures: boolean,
  locale: Locale,
) {
  if (property)
    return {
      label: matchedTitle(property, locale),
      explanation: matchedExplanation(property, locale),
    }
  if (fact && hasFeatures) return { label: factLabel(fact, locale), explanation: undefined }
  return { label: undefined, explanation: undefined }
}

export function sceneLocation(result: SearchResult | undefined, camera: Camera | undefined) {
  return [
    result?.hotel.location[0] ?? camera?.center[0] ?? 39.72,
    result?.hotel.location[1] ?? camera?.center[1] ?? 43.59,
  ] as const
}

export function hasLine(features: readonly unknown[]) {
  return features.some((feature) => {
    const data = feature as { geometry?: { type?: string }; properties?: { kind?: string } }
    return (
      data.properties?.kind === "route" &&
      (data.geometry?.type === "LineString" || data.geometry?.type === "MultiLineString")
    )
  })
}
