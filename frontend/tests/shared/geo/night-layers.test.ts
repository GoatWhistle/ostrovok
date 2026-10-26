import { describe, expect, it } from "vitest"
import { nightFactor, windowFade } from "@/shared/geo/night-city/night-layers"

describe("night lighting curve", () => {
  it("is off in daylight, ramps through twilight and is full at night", () => {
    expect(nightFactor(30)).toBe(0)
    expect(nightFactor(2)).toBe(0)
    expect(nightFactor(-2)).toBe(0.5)
    expect(nightFactor(-6)).toBe(1)
    expect(nightFactor(-40)).toBe(1)
  })

  it("fades windows in between zoom 16 and 17", () => {
    expect(windowFade(15.5)).toBe(0)
    expect(windowFade(16.5)).toBe(0.5)
    expect(windowFade(18)).toBe(1)
  })
})
