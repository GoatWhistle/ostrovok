import { describe, expect, it } from "vitest"
import { featureCollection, validGeometry } from "@/shared/geo/geometry"

describe("untrusted scene geometry", () => {
  it.each([
    null,
    {},
    { type: "Point", coordinates: [999, 40] },
    { type: "Point", coordinates: [40, Number.NaN] },
    { type: "LineString", coordinates: [[39, 43]] },
    {
      type: "Polygon",
      coordinates: [
        [
          [39, 43],
          [40, 43],
          [40, 44],
        ],
      ],
    },
  ])("rejects invalid geometry %j", (value) => {
    expect(validGeometry(value)).toBe(false)
  })
  it("keeps valid polygons, lines and points without inventing coordinates", () => {
    const items = [
      {
        type: "Feature",
        id: "building",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [39, 43],
              [40, 43],
              [40, 44],
              [39, 43],
            ],
          ],
        },
        properties: { height_m: 18 },
      },
      { type: "Feature", id: "broken", geometry: { type: "Point", coordinates: [999, 43] } },
    ]
    expect(featureCollection(items).features).toHaveLength(1)
    expect(featureCollection(items).features[0]?.geometry).toEqual(items[0]?.geometry)
    expect(featureCollection(items).features[0]?.properties).toEqual({ height_m: 18 })
  })
})
