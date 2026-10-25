import type {
  Camera,
  GeoFeatureCollection,
  HotelScene,
  SearchResult,
} from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"

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
