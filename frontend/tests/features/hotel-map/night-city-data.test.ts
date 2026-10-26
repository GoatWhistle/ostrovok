import type { Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it } from "vitest"
import type { MapRenderScene } from "@/entities/map-data"
import {
  drawnVolumes,
  sceneCollection,
  windowBuildings,
} from "@/features/hotel-map/night-city/night-city-data"

const RING = [
  [39.9, 43.44],
  [39.901, 43.44],
  [39.901, 43.441],
  [39.9, 43.44],
]

function building(id: string, renderHeight: number) {
  return {
    type: "Feature" as const,
    id,
    geometry: { type: "Polygon" as const, coordinates: [RING] },
    properties: {
      building_id: id,
      hotel_id: null,
      class: "house",
      class_source: "tag",
      height_m: null,
      levels: null,
      height_source: "unknown",
      render_height_m: renderHeight,
      height_estimated: true,
      min_height_m: 0,
      ground_elevation_m: null,
      ground_source: null,
    },
  }
}

const scene: MapRenderScene = {
  region_id: "sochi",
  version: "osm-1",
  bbox: [39.89, 43.43, 39.91, 43.45],
  truncated: false,
  eligible_count: 3,
  features: [building("near", 6.4), building("hotel", 6.4), building("far", 9.6)],
}
const map = { queryTerrainElevation: () => 12 } as unknown as MapLibreMap

describe("windowBuildings", () => {
  it("lights every scene building except the textured hotel", () => {
    const drawn = drawnVolumes([
      { id: "near", properties: { building_id: "near", height_m: 21, min_height_m: 3 } },
      { id: "hotel", properties: { building_id: "hotel", height_m: 30 } },
    ])
    const lit = windowBuildings(map, scene, drawn, new Set(["hotel"]))
    expect(lit.map((item) => item.id)).toEqual(["near", "far"])
  })

  it("matches window walls to the volume that is actually drawn", () => {
    const drawn = drawnVolumes([
      { id: "near", properties: { building_id: "near", height_m: 21, min_height_m: 3 } },
    ])
    const [near, hotel, far] = windowBuildings(map, scene, drawn, new Set())
    expect(near).toMatchObject({ ground: 12, base: 3, height: 21 })
    expect(hotel).toMatchObject({ base: 0, height: 6.4 })
    expect(far).toMatchObject({ base: 0, height: 9.6 })
  })

  it("treats missing or broken heights as zero", () => {
    const drawn = drawnVolumes([{ id: "x", properties: { height_m: "n/a", min_height_m: -4 } }])
    expect(drawn.get("x")).toEqual({ height: 0, base: 0 })
  })
})

describe("sceneCollection", () => {
  it("hands MapLibre a real GeoJSON FeatureCollection", () => {
    const collection = sceneCollection(scene)
    expect(collection.type).toBe("FeatureCollection")
    expect(collection.features).toHaveLength(3)
  })
})
