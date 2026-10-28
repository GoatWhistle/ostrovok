import { describe, expect, it } from "vitest"
import type { Fact } from "@/shared/api/hotel-types"
import { sunsetExplanation } from "@/shared/geo/sun/sunset-explanation"

function fact(qualifiers: Record<string, unknown>): Fact {
  return {
    fact_id: "f",
    characteristic_key: "sunset_view",
    value: true,
    unit: null,
    label: "Sunset view",
    confidence: 0.75,
    source_type: "computed",
    status: "active",
    geo_refs: [],
    subject: "hotel:h1",
    qualifiers,
    explanation: "",
  } as unknown as Fact
}

const ARC = {
  sunset_azimuth_from_deg: 284,
  sunset_azimuth_to_deg: 303,
  season_from_month: 4,
  season_to_month: 8,
}

describe("sunsetExplanation", () => {
  it("keeps the season, the arc and the floor in English", () => {
    const text = sunsetExplanation(
      fact({ ...ARC, facades_facing_sunset: 2, from_floor: 5, bookable_room_confirmed: false }),
      "en",
    )

    expect(text).toContain("April")
    expect(text).toContain("August")
    expect(text).toContain("284")
    expect(text).toContain("303")
    expect(text).toContain("floor 5")
    expect(text).toContain("no bookable room is confirmed")
  })

  it("says plainly when no facade faces the sunset", () => {
    const text = sunsetExplanation(fact({ ...ARC, facades_facing_sunset: 0 }), "en")

    expect(text).toContain("no facade faces the sunset")
    expect(text).not.toContain("floor")
  })

  it("drops the caveat once a room on that floor is known", () => {
    const text = sunsetExplanation(
      fact({ ...ARC, facades_facing_sunset: 1, from_floor: 3, bookable_room_confirmed: true }),
      "en",
    )

    expect(text).toContain("floor 3")
    expect(text).not.toContain("no bookable room")
  })

  it("ignores a fact of another characteristic or without the arc", () => {
    expect(sunsetExplanation({ ...fact(ARC), characteristic_key: "noise_level" }, "en")).toBe(
      undefined,
    )
    expect(sunsetExplanation(fact({ season_from_month: 4 }), "en")).toBe(undefined)
  })
})
