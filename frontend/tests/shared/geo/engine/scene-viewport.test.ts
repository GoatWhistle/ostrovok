import { describe, expect, it } from "vitest"
import { sceneArea } from "@/shared/geo/engine/scene-viewport"

describe("sceneArea", () => {
  it("asks for nothing below street zoom", () => {
    expect(sceneArea([39.9, 43.44], 15.9)).toBeUndefined()
  })

  it("keeps the request near the centre, on a shared grid and under 4 km²", () => {
    const area = sceneArea([39.90412, 43.44513], 17.4)
    expect(area?.zoom).toBe(17)
    const [west, south, east, north] = area?.bbox ?? [0, 0, 0, 0]
    expect(west).toBeLessThan(39.90412)
    expect(east).toBeGreaterThan(39.90412)
    const km2 =
      (east - west) * 111.32 * Math.cos((43.445 * Math.PI) / 180) * (north - south) * 111.32
    expect(km2).toBeLessThan(4)
    expect(sceneArea([39.90413, 43.44514], 17.9)?.bbox).toEqual(area?.bbox)
  })

  it("never exceeds the 4 km² server limit after snapping", () => {
    for (const lat of [41.2, 43.44, 55.75, 69.0])
      for (let step = 0; step < 50; step += 1) {
        const area = sceneArea([39.9 + step * 0.00037, lat + step * 0.00041], 16)
        const [west, south, east, north] = area?.bbox ?? [0, 0, 0, 0]
        const middle = ((south + north) / 2) * (Math.PI / 180)
        const km2 = (east - west) * 111.32 * Math.cos(middle) * (north - south) * 111.32
        expect(km2).toBeLessThan(4)
      }
  })
})
