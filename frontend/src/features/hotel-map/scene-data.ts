import type {
  Camera,
  GeoFeatureCollection,
  HotelScene,
  SearchResult,
} from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
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
      ? results.map((result) => result.footprint).filter((item) => item !== undefined)
      : []),
    ...(scene?.context_buildings?.features ?? []),
    ...(scene?.building.features ?? []),
  ]
  const focus = selectedCamera?.focus_facade_id
  const facades = focus ? (scene?.facades?.filter((facade) => facade.id === focus) ?? []) : []
  const highlights = [
    ...(!scene
      ? results.map((result) => ({
          type: "Feature",
          id: result.hotel.id,
          geometry: { type: "Point", coordinates: result.hotel.location },
          properties: {},
        }))
      : []),
    ...(geometry?.features ?? []),
    ...facades.map((facade) => ({ type: "Feature", geometry: facade.geometry, properties: {} })),
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
        Boolean(building.properties?.height_estimated) ||
        Boolean(building.properties?.is_hotel && !building.properties.height_m),
    ),
  }
}
