import { describe, expect, it } from "vitest"
import {
  forecastEnd,
  localClock,
  sunScene,
} from "../../../src/features/hotel-map/scene-time/scene-time"

describe("Sochi scene time", () => {
  it("uses degree bearings and Moscow time for the sun and forecast window", () => {
    const afternoon = sunScene("2026-10-25", 16, 43.59, 39.72)
    const evening = sunScene("2026-10-25", 18, 43.59, 39.72)
    expect(afternoon.position.altitude).toBeGreaterThan(12)
    expect(afternoon.position.altitude).toBeLessThan(14)
    expect(afternoon.position.azimuth).toBeGreaterThan(238)
    expect(afternoon.position.azimuth).toBeLessThan(240)
    expect(evening.position.altitude).toBeLessThan(0)
    expect(localClock(afternoon.times.sunset, "ru")).toBe("17:22")
    expect(forecastEnd("2026-10-25")).toBe("2026-11-09")
  })

  it("moves the sun between whole hours", () => {
    const four = sunScene("2026-10-25", 16, 43.59, 39.72).position
    const half = sunScene("2026-10-25", 16.5, 43.59, 39.72).position
    const five = sunScene("2026-10-25", 17, 43.59, 39.72).position
    expect(half.azimuth).toBeGreaterThan(four.azimuth)
    expect(half.azimuth).toBeLessThan(five.azimuth)
    expect(half.altitude).toBeLessThan(four.altitude)
  })
})
