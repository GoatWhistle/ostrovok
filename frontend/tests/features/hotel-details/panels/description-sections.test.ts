import { describe, expect, it } from "vitest"
import { descriptionSections } from "../../../../src/features/hotel-details/supplier/description-sections"
import en from "../../../../src/shared/i18n/locales/en/explore.json"
import ru from "../../../../src/shared/i18n/locales/ru/explore.json"

const sections = [
  { title: ru.hotelCard.descriptionTitles.nearby[0] ?? "", paragraphs: ["Location paragraph"] },
  { title: ru.hotelCard.descriptionTitles.amenities[1] ?? "", paragraphs: ["Amenities paragraph"] },
  { title: en.hotelCard.descriptionTitles.rooms[0] ?? "", paragraphs: ["Room paragraph"] },
  { title: "Additional policies", paragraphs: ["Original conditions"] },
]

describe("supplier description placement", () => {
  it("keeps location in About and separates amenities and rooms", () => {
    expect(descriptionSections(sections, "amenities")).toEqual([sections[1]])
    expect(descriptionSections(sections, "rooms")).toEqual([sections[2]])
    expect(descriptionSections(sections, "about")).toEqual([sections[0], sections[3]])
  })

  it("preserves every original section in exactly one destination", () => {
    const placed = (["about", "amenities", "rooms"] as const).flatMap((topic) =>
      descriptionSections(sections, topic),
    )
    expect(placed).toHaveLength(sections.length)
    expect(new Set(placed).size).toBe(sections.length)
    expect(placed).toEqual(expect.arrayContaining(sections))
  })
})
