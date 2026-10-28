import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson"
import type { HotelScene, SearchResult } from "@/shared/api/hotel-types"
import { featureCollection } from "../geometry/geometry"

export type TexturedFootprint = Feature<Polygon | MultiPolygon>

export function selectedFootprints(
  hotelId: string | undefined,
  scene: HotelScene | undefined,
  results: readonly SearchResult[],
): FeatureCollection<Polygon | MultiPolygon> {
  const values =
    hotelId && scene?.hotel_id === hotelId
      ? (scene.building.features ?? [])
      : results.filter((item) => item.hotel.id === hotelId).map((item) => item.footprint)
  const features = featureCollection(hotelId ? values : []).features.filter(
    (feature): feature is TexturedFootprint =>
      (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") &&
      Number.isFinite(feature.properties?.height_m) &&
      feature.properties?.height_m > Math.max(0, feature.properties?.min_height_m ?? 0),
  )
  return { type: "FeatureCollection", features }
}

export function remainingBuildings(
  data: FeatureCollection,
  selected: readonly TexturedFootprint[],
) {
  const ids = new Set(
    selected.flatMap((item) => [item.id, item.properties?.building_id]).filter(Boolean),
  )
  const geometries = new Set(selected.map((item) => JSON.stringify(item.geometry)))
  return {
    ...data,
    features: data.features.filter(
      (item) =>
        !ids.has(item.id) &&
        !ids.has(item.properties?.building_id) &&
        !geometries.has(JSON.stringify(item.geometry)),
    ),
  }
}
