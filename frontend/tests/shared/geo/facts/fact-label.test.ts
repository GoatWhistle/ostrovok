import { describe, expect, it } from "vitest"
import type { FactBrief } from "@/shared/api/hotel-types"
import { factLabel } from "@/shared/geo/facts/fact-label"
import en from "@/shared/i18n/locales/en/explore.json"
import ru from "@/shared/i18n/locales/ru/explore.json"

function ownerFact(key: string, value: boolean | null): FactBrief {
  return {
    fact_id: "owner-answer",
    characteristic_key: key,
    value,
    label: `${key}: ${value}`,
    confidence: 1,
    source_type: "hotelier",
    status: "confirmed_by_hotelier",
  }
}

describe("owner answer labels", () => {
  for (const [locale, copy] of [
    ["ru", ru],
    ["en", en],
  ] as const) {
    it(`renders boolean curtain facts in ${locale} without technical values`, () => {
      for (const value of [true, false, null]) {
        const label = factLabel(ownerFact("blackout_curtains", value), locale)
        expect(label).not.toContain("blackout_curtains")
        expect(label).toContain(copy.facts.titleBlackout)
      }
    })
    it(`renders positive and negative sunset answers in ${locale}`, () => {
      expect(factLabel(ownerFact("sunset_view", true), locale)).toBe(copy.wish.sunset)
      expect(factLabel(ownerFact("sunset_view", false), locale)).toBe(copy.wish.noSunset)
    })
  }
})
