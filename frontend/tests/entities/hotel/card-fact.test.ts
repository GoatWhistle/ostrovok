import { describe, expect, it } from "vitest"
import { cardFact } from "../../../src/entities/hotel/hotel-result/card-fact"
import type { MatchedProperty } from "../../../src/shared/api/hotel-types"
import "../../../src/shared/i18n/instance"

function measured(key: string, value: number, match: MatchedProperty["match"]): MatchedProperty {
  return {
    characteristic_key: `derived:${key}`,
    label: key,
    match,
    fact: {
      fact_id: key,
      characteristic_key: `derived:${key}`,
      label: key,
      value: true,
      confidence: 1,
      source_type: "computed",
      status: "active",
      qualifiers: { native_characteristic_key: key, native_value: value },
    },
  }
}

describe("card fact", () => {
  it("prefers a measured verdict from a full match", () => {
    const fact = cardFact(
      [measured("noise_level", 1, "partial"), measured("distance_to_sea", 3, "full")],
      "en",
    )
    expect(fact).toContain("3")
  })

  it("returns nothing without usable matches", () => {
    expect(cardFact([measured("distance_to_sea", 3, "none")], "en")).toBeUndefined()
  })
})
