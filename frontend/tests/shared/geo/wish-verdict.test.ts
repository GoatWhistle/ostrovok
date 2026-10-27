import { describe, expect, it } from "vitest"
import type { MatchedProperty } from "../../../src/shared/api/hotel-types"
import { wishVerdict } from "../../../src/shared/geo/facts/wish-verdict"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

function noise(score: number): MatchedProperty {
  return {
    characteristic_key: "derived:quiet",
    label: "quiet",
    match: "partial",
    fact: {
      fact_id: "quiet",
      characteristic_key: "derived:quiet",
      label: "quiet",
      value: true,
      confidence: 0.6,
      source_type: "computed",
      status: "active",
      qualifiers: { native_characteristic_key: "noise_level", native_value: score },
    },
  }
}

describe("wish verdict", () => {
  it("says there is nothing noisy nearby instead of a zero score", () => {
    expect(wishVerdict(noise(0), "ru")).toBe(ru.wish.silent)
    expect(wishVerdict(noise(1.8), "ru")).toBe(ru.wish.quiet.replace("{{score}}", "1,8"))
  })
})
