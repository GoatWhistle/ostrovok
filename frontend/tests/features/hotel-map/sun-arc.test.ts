import { describe, expect, it } from "vitest"
import {
  arcFraction,
  exactHour,
  fractionFromPoint,
  hourFromFraction,
} from "../../../src/features/hotel-map/scene-time/sun-arc"

describe("sun arc", () => {
  it("places sunrise at the start and sunset at the end of the arc", () => {
    expect(arcFraction(7, 7, 18)).toBe(0)
    expect(arcFraction(18, 7, 18)).toBe(1)
    expect(arcFraction(12.5, 7, 18)).toBeCloseTo(0.5, 2)
  })

  it("keeps hours inside the daylight range", () => {
    expect(hourFromFraction(0, 7, 18)).toBe(7)
    expect(hourFromFraction(1, 7, 18)).toBe(18)
    expect(hourFromFraction(0.5, 7, 18)).toBe(13)
  })

  it("keeps minutes while the sun is dragged", () => {
    expect(exactHour(0.5, 7, 18)).toBeCloseTo(12.5, 5)
    expect(exactHour(2, 7, 18)).toBe(18)
  })

  it("reads the pointer angle from the left end to the right end", () => {
    expect(fractionFromPoint(0, 52, 104)).toBeCloseTo(0, 2)
    expect(fractionFromPoint(104, 52, 104)).toBeCloseTo(1, 2)
    expect(fractionFromPoint(52, 6, 104)).toBeCloseTo(0.5, 2)
  })

  it("never leaves the arc when the pointer goes below the horizon", () => {
    const low = fractionFromPoint(10, 300, 104)
    expect(low).toBeGreaterThanOrEqual(0)
    expect(low).toBeLessThanOrEqual(1)
  })
})
