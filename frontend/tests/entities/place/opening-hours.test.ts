import { describe, expect, it } from "vitest"
import { isOpen, parseOpeningHours } from "@/entities/place/opening-hours"

describe("opening hours", () => {
  it("handles daily hours and closing boundaries at the selected local time", () => {
    const rules = parseOpeningHours("Mo-Su 10:00-23:00") ?? []
    expect(isOpen(rules, "2026-10-26", 9)).toBe(false)
    expect(isOpen(rules, "2026-10-26", 10)).toBe(true)
    expect(isOpen(rules, "2026-10-26", 23)).toBe(false)
    expect(isOpen(parseOpeningHours("24/7") ?? [], "2026-10-25", 0)).toBe(true)
  })
  it("handles lists, split intervals, overrides and midnight across the week", () => {
    const rules = parseOpeningHours("Mo,We 10:00-13:00,16:00-20:00; Fr-Su 20:00-02:00") ?? []
    expect(isOpen(rules, "2026-10-26", 1)).toBe(true)
    expect(isOpen(rules, "2026-10-26", 2)).toBe(false)
    expect(isOpen(rules, "2026-10-26", 14)).toBe(false)
    expect(isOpen(rules, "2026-10-26", 17)).toBe(true)
    expect(isOpen(rules, "2026-10-27", 17)).toBe(false)
    const override = parseOpeningHours("Mo-Su 10:00-20:00; Mo off") ?? []
    expect(isOpen(override, "2026-10-26", 12)).toBe(false)
  })
  it("does not guess for holidays, seasonal rules or malformed hours", () => {
    for (const value of [
      "Mo-Fr 10:00-18:00; PH off",
      "sunrise-sunset",
      "10:99-20:00",
      "24:01-25:00",
      "Apr-Oct Mo-Su 10:00-18:00",
      "24/7;",
      "Mo 10:00-10:00",
    ])
      expect(parseOpeningHours(value)).toBeUndefined()
  })
})
