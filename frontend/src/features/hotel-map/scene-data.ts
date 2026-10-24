import type { Camera, GeoFeatureCollection, HotelScene } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
export function sceneData(
  scene: HotelScene | undefined,
  camera: Camera | undefined,
  region: Camera | undefined,
  geometry: GeoFeatureCollection | undefined,
) {
  const selectedCamera = camera ?? scene?.cameras.best_match ?? scene?.cameras.overview ?? region
  const buildings = [
    ...(scene?.context_buildings?.features ?? []),
    ...(scene?.building.features ?? []),
  ]
  const focus = selectedCamera?.focus_facade_id
  const facades = focus ? (scene?.facades?.filter((facade) => facade.id === focus) ?? []) : []
  const highlights = [
    ...(geometry?.features ?? []),
    ...facades.map((facade) => ({ type: "Feature", geometry: facade.geometry, properties: {} })),
  ]
  return { selectedCamera, buildings, highlights }
}
export function sceneQuality(
  buildings: readonly { properties?: { height_m?: number } }[],
  highlights: readonly unknown[],
) {
  return {
    invalid:
      featureCollection(buildings).features.length < buildings.length ||
      featureCollection(highlights).features.length < highlights.length,
    missingHeight: buildings.some((building) => building.properties?.height_m === undefined),
  }
}
