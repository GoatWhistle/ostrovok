import { describe, expect, it } from "vitest"
import { bestHotels, differs } from "../../../../src/features/hotel-comparison/model/compare-diff"
import type { FactBrief } from "../../../../src/shared/api/hotel-types"

function fact(value: FactBrief["value"], unit = "min"): FactBrief {
  return {
    fact_id: "f1",
    characteristic_key: "distance_to_sea",
    value,
    unit,
    label: "Walk",
    confidence: 0.9,
    source_type: "computed",
    status: "active",
    geo_refs: [],
  }
}

const rows = [
  { hotel_id: "a", cells: { distance_to_sea: fact(5) } },
  { hotel_id: "b", cells: { distance_to_sea: fact(3) } },
  { hotel_id: "c", cells: { distance_to_sea: fact(3) } },
] as const

describe("hotel comparison differences", () => {
  it("keeps missing evidence distinct from zero and false", () => {
    expect(differs([undefined, fact(0)])).toBe(true)
    expect(differs([fact(false), fact(0)])).toBe(true)
    expect(differs([undefined, undefined])).toBe(false)
  })
  it("compares values together with their units", () => {
    expect(differs([fact(3), fact(3)])).toBe(false)
    expect(differs([fact(3), fact(3, "m")])).toBe(true)
  })
  it("requires a declared direction and preserves ties at the minimum", () => {
    expect(bestHotels(rows, "distance_to_sea", undefined)).toEqual([])
    expect(bestHotels(rows, "distance_to_sea", "lower")).toEqual(["b", "c"])
    expect(bestHotels(rows, "distance_to_sea", "higher")).toEqual(["a"])
  })
  it("does not declare a winner from incompatible units or one known value", () => {
    expect(
      bestHotels(
        [rows[0], { hotel_id: "b", cells: { distance_to_sea: fact(1, "m") } }],
        "distance_to_sea",
        "lower",
      ),
    ).toEqual([])
    expect(bestHotels([rows[0], { hotel_id: "b", cells: {} }], "distance_to_sea", "lower")).toEqual(
      [],
    )
  })
})
