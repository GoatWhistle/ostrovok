import { expect, it } from "vitest"
import { placeTargets } from "@/features/hotel-map/markers/place-targets"

it("combines each place and its walk into one accessible marker, keeping two labels", () => {
  const features = [1, 2, 3].flatMap((id) => [
    {
      type: "Feature",
      id: `g_poi_n${id}`,
      geometry: { type: "Point", coordinates: [39.9, 43.4] },
      properties: { name: `Bar ${id}` },
    },
    {
      type: "Feature",
      id: `g_walk_n0_n${id}`,
      geometry: {
        type: "LineString",
        coordinates: [
          [39.91, 43.4],
          [39.9, 43.4],
        ],
      },
      properties: { kind: "route", place_id: `n${id}`, distance_m: id * 80, minutes: id },
    },
  ])
  const targets = placeTargets(features, undefined, "en")
  expect(targets).toHaveLength(3)
  expect(targets.map((item) => item.quiet)).toEqual([false, false, true])
  expect(targets[0]?.ariaLabel).toContain("Bar 1")
  expect(targets[0]?.label).toContain("1")
})

it("keeps nameless places clickable and labels straight lines without walking time", () => {
  const targets = placeTargets(
    [
      {
        type: "Feature",
        id: "g_poi_n1",
        geometry: { type: "Point", coordinates: [39.9, 43.4] },
        properties: {},
      },
      {
        type: "Feature",
        id: "g_walk_n0_n2",
        geometry: {
          type: "LineString",
          coordinates: [
            [39.91, 43.4],
            [39.9, 43.4],
          ],
        },
        properties: { kind: "route", place_id: "n2", distance_m: 70, minutes: null },
      },
    ],
    undefined,
    "en",
  )
  expect(targets[0]?.placeId).toBe("n1")
  expect(targets[0]?.label).toBe("Unnamed place")
  expect(targets[1]?.label).toContain("straight line")
})
