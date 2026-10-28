import { describe, expect, it } from "vitest"
import { amenityDescriptions } from "../../../../src/features/hotel-details/supplier/amenity-descriptions"
import en from "../../../../src/shared/i18n/locales/en/explore.json"

const kitchen = { name: "Shared kitchen", free: true }
const bar = { name: "Bar", free: false }
const groups = [{ name: "Meals", amenities: [kitchen, bar] }]
const section = (paragraphs: string[]) => [
  {
    title: en.hotelCard.descriptionTitles.amenities[0] ?? "",
    paragraphs,
  },
]

describe("amenity descriptions", () => {
  it("places the matching explanation directly with the amenity without repeating its name", () => {
    const result = amenityDescriptions(
      groups,
      section(["Shared kitchen is available for cooking."]),
    )
    expect(result.descriptions.get(kitchen)).toEqual(["Is available for cooking."])
    expect(result.remaining).toEqual([])
  })

  it("preserves unmatched conditions and does not confuse partial words with an amenity", () => {
    const result = amenityDescriptions(groups, section(["Barra Hotel is nearby. Fees may apply."]))
    expect(result.descriptions.get(bar)).toBeUndefined()
    expect(result.remaining).toEqual(["Barra Hotel is nearby.", "Fees may apply."])
  })

  it("does not repeat a sentence across matching amenities or lose its original contents", () => {
    const specific = { name: "Pool bar", free: false }
    const result = amenityDescriptions(
      [...groups, { name: "Pool", amenities: [specific] }],
      section(["The pool bar is open."]),
    )
    expect(result.descriptions.get(specific)).toEqual(["The pool bar is open."])
    expect(result.descriptions.get(bar)).toBeUndefined()
  })
})
