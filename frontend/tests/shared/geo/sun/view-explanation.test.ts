import { describe, expect, it } from "vitest"
import type { Fact } from "@/shared/api/hotel-types"
import { factExplanation } from "@/shared/geo/facts/fact-label"

function fact(status: string): Fact {
  return {
    fact_id: "view",
    characteristic_key: "derived:wish",
    value: status === "visible",
    label: "View of the cathedral",
    confidence: 0.8,
    source_type: "computed",
    status: "active",
    qualifiers: {
      visibility: {
        status,
        floor: 7,
        target_name: "Cathedral",
        distance_m: 155,
        bookable_room_confirmed: false,
      },
    },
  }
}

describe("calculated window view explanation", () => {
  it("keeps floor and facade limits for derived facts in English", () => {
    const text = factExplanation(fact("visible"), "en")
    expect(text).toContain("floor 7")
    expect(text).toContain("Cathedral")
    expect(text).toContain("facade")
    expect(text).toContain("confirm")
  })
  it("does not present unknown visibility as supported", () => {
    expect(factExplanation(fact("unknown"), "en")).toContain("could not be confirmed")
  })
  it("distinguishes an obstructed view", () => {
    expect(factExplanation(fact("blocked"), "en")).toContain("blocked")
  })
})
