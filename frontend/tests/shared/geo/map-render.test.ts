import { describe, expect, it } from "vitest"
import { roofPaint } from "../../../src/shared/geo/appearance/roofs"
import { shadowOffset } from "../../../src/shared/geo/appearance/shadows"

describe("daylight map render", () => {
  it("spreads roof colours across buildings by feature id", () => {
    const paint = roofPaint(["#a", "#b", "#c"])
    expect(Array.isArray(paint)).toBe(true)
    expect(JSON.stringify(paint)).toContain('"height_m"')
    expect(JSON.stringify(paint)).toContain('["%"')
  })

  it("keeps a single roof colour when only one is given", () => {
    expect(roofPaint(["#a"])).toBe("#a")
    expect(roofPaint([])).toBeUndefined()
  })

  it("drops ground shadows when the sun is at or below the horizon", () => {
    expect(shadowOffset(180, 0)).toEqual([0, 0])
    expect(shadowOffset(180, -20)).toEqual([0, 0])
  })

  it("casts the shadow away from the sun and lengthens it as the sun sinks", () => {
    const [, noonY] = shadowOffset(180, 60)
    const [, eveningY] = shadowOffset(180, 10)
    expect(noonY).toBeLessThan(0)
    expect(Math.abs(eveningY)).toBeGreaterThan(Math.abs(noonY))
  })
})
