import { describe, expect, it } from "vitest"
import { amenityGroupName, amenityName } from "../../../src/entities/hotel/amenity/amenity-name"
import en from "../../../src/shared/i18n/locales/en/explore.json"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"
import "../../../src/shared/i18n/instance"

describe("supplier amenity names", () => {
  it("translates known supplier amenities into English", () => {
    expect(amenityName(ru.supplierAmenity.freeWifi, "en")).toEqual({
      text: en.supplierAmenity.freeWifi,
      lang: undefined,
    })
    expect(amenityGroupName(` ${ru.supplierAmenityGroup.meals} `, "en").text).toBe(
      en.supplierAmenityGroup.meals,
    )
  })

  it("keeps an unknown supplier name and marks its language", () => {
    expect(amenityName("Unlisted amenity", "en")).toEqual({ text: "Unlisted amenity", lang: "ru" })
    expect(amenityName("Unlisted amenity", "ru").lang).toBeUndefined()
  })
})
