import type { FeatureCollection, MultiPolygon, Polygon } from "geojson"
import { describe, expect, test } from "vitest"
import type { HotelScene, SearchResult } from "@/shared/api/hotel-types"
import { buildingMesh } from "@/shared/geo/textured-building/geometry"
import {
  remainingBuildings,
  selectedFootprints,
  type TexturedFootprint,
} from "@/shared/geo/textured-building/selection"

const OUTSIDE = [
  [39, 43],
  [39.002, 43],
  [39.002, 43.002],
  [39, 43.002],
  [39, 43],
]
const COURTYARD = [
  [39.0005, 43.0005],
  [39.0015, 43.0005],
  [39.0015, 43.0015],
  [39.0005, 43.0015],
  [39.0005, 43.0005],
]

function building(
  id: string,
  geometry: Polygon | MultiPolygon = { type: "Polygon", coordinates: [OUTSIDE] },
): TexturedFootprint {
  return {
    type: "Feature",
    id,
    geometry,
    properties: { building_id: id, height_m: 12.8, min_height_m: 3.2 },
  }
}

function scene(hotel: string, features: readonly TexturedFootprint[]): HotelScene {
  return { hotel_id: hotel, building: { features }, cameras: {} } as unknown as HotelScene
}

function result(id: string, footprint: TexturedFootprint | null): SearchResult {
  return { hotel: { id }, footprint } as SearchResult
}

describe("the selected hotel owns the textured volume", () => {
  test("an old scene never contributes buildings after selection changes", () => {
    const old = building("old")
    const next = building("next")
    expect(
      selectedFootprints("next", scene("old", [old]), [result("next", next)]).features,
    ).toEqual([next])
    expect(selectedFootprints("next", scene("old", [old]), []).features).toEqual([])
  })

  test("clearing selection and missing footprints leave every hotel untextured", () => {
    expect(selectedFootprints(undefined, scene("old", [building("old")]), []).features).toEqual([])
    expect(selectedFootprints("next", undefined, [result("next", null)]).features).toEqual([])
  })

  test("only the selected hotel is suppressed from ordinary buildings", () => {
    const chosen = building("chosen")
    const neighbor = building("neighbor", {
      type: "Polygon",
      coordinates: [OUTSIDE.map(([x = 0, y = 0]) => [x + 1, y])],
    })
    const data: FeatureCollection = { type: "FeatureCollection", features: [chosen, neighbor] }
    expect(remainingBuildings(data, [chosen]).features).toEqual([neighbor])
    expect(remainingBuildings(data, []).features).toEqual([chosen, neighbor])
  })

  test("a matching scene uses all hotel wings and excludes unknown heights", () => {
    const main = building("main")
    const annex = building("annex")
    const unknown = { ...building("unknown"), properties: { height_m: undefined } }
    const inverted = { ...building("inverted"), properties: { height_m: 2, min_height_m: 3 } }
    expect(
      selectedFootprints("hotel", scene("hotel", [main, annex, unknown, inverted]), []).features,
    ).toEqual([main, annex])
  })
})

function roofArea(vertices: Float32Array) {
  let sum = 0
  for (let i = 0; i < vertices.length; i += 27) {
    if (vertices[i + 8] !== 1) continue
    const ax = vertices[i] ?? 0
    const ay = vertices[i + 1] ?? 0
    const bx = vertices[i + 9] ?? 0
    const by = vertices[i + 10] ?? 0
    const cx = vertices[i + 18] ?? 0
    const cy = vertices[i + 19] ?? 0
    sum += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2
  }
  return sum
}

describe("real footprint geometry determines the textured volume", () => {
  test("courtyards stay open instead of being covered by a roof", () => {
    const solid = buildingMesh([building("solid")])
    const courtyard = buildingMesh([
      building("courtyard", { type: "Polygon", coordinates: [OUTSIDE, COURTYARD] }),
    ])
    expect(solid).toBeDefined()
    expect(courtyard).toBeDefined()
    if (!solid || !courtyard) return
    expect(roofArea(courtyard.vertices) / roofArea(solid.vertices)).toBeCloseTo(0.75, 3)
  })

  test("disconnected wings are both extruded at API heights and minimum heights", () => {
    const mesh = buildingMesh([
      building("wings", {
        type: "MultiPolygon",
        coordinates: [[OUTSIDE], [OUTSIDE.map(([x = 0, y = 0]) => [x + 0.003, y])]],
      }),
    ])
    expect(mesh?.vertices.length).toBe(60 * 9)
    const heights = Array.from(mesh?.vertices ?? []).filter((_, i) => i % 9 === 2)
    expect(Math.min(...heights)).toBeCloseTo(3.2)
    expect(Math.max(...heights)).toBeCloseTo(12.8)
  })

  test("a degenerate outline produces no fabricated building", () => {
    expect(
      buildingMesh([
        building("line", {
          type: "Polygon",
          coordinates: [
            [
              [39, 43],
              [39.001, 43],
              [39.002, 43],
              [39, 43],
            ],
          ],
        }),
      ]),
    ).toBeUndefined()
    expect(buildingMesh([])).toBeUndefined()
  })
})
