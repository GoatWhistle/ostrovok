import { describe, expect, it } from "vitest"
import { hotelPoint } from "@/shared/geo/hotel-point"

describe("hotel point", () => {
  it("accepts a finite longitude and latitude", () => {
    expect(hotelPoint([39.72, 43.58])).toEqual([39.72, 43.58])
    expect(hotelPoint([0, 0])).toEqual([0, 0])
  })

  it.each([
    [undefined],
    [null],
    [[]],
    [[39.72]],
    [[Number.NaN, 43.58]],
    [[39.72, Number.POSITIVE_INFINITY]],
    [[181, 43.58]],
    [[39.72, 86]],
  ])("rejects %j instead of inventing a position", (location) => {
    expect(hotelPoint(location)).toBeUndefined()
  })
})
