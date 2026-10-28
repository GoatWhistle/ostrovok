import { describe, expect, it } from "vitest"
import { roofPaint } from "../../../src/shared/geo/appearance/roofs"
import { shadowOffset } from "../../../src/shared/geo/appearance/shadows"
import { tintStrength } from "../../../src/shared/geo/sun/horizon-tint"

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

describe("environment tint", () => {
  it("leaves the palette alone while the sun is high", () => {
    expect(tintStrength(40)).toBe(0)
  })

  it("warms the whole scene as the sun drops to the horizon", () => {
    expect(tintStrength(6)).toBeGreaterThan(0)
    expect(tintStrength(1)).toBeGreaterThan(tintStrength(6))
  })

  it("keeps deepening after sunset and then holds", () => {
    expect(tintStrength(-4)).toBeGreaterThan(tintStrength(1))
    expect(tintStrength(-30)).toBe(tintStrength(-8))
  })
})
