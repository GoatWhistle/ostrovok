import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { HotelAmenities } from "../../../../src/features/hotel-details/panels/hotel-amenities"
import type { components } from "../../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../../src/shared/i18n"
import en from "../../../../src/shared/i18n/locales/en/explore.json"

type Supplier = components["schemas"]["SupplierDetails"]
const supplier: Supplier = {
  supplier_id: "one",
  page_url: "https://example.test",
  name: "Hotel",
  photos: [],
  facts: {},
  nearby: [],
  amenity_groups: [
    { name: "Internet", amenities: [{ name: "Wi-Fi", free: true }] },
    { name: "Meals", amenities: [{ name: "Shared kitchen", free: true }] },
  ],
  description: [
    {
      title: en.hotelCard.descriptionTitles.amenities[0] ?? "",
      paragraphs: ["Shared kitchen is available for cooking."],
    },
  ],
}

function show() {
  return render(
    <LocaleProvider instance={createI18n("en")}>
      <HotelAmenities
        card={{ hotel: { id: "one", name: "Hotel", location: [39.7, 43.6] }, facts: [] }}
        supplier={supplier}
      />
    </LocaleProvider>,
  )
}

describe("amenity categories", () => {
  it("starts compact and opens only the requested category", async () => {
    show()
    expect(screen.queryByRole("listitem")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Internet" }))
    expect(screen.getByText("Wi-Fi")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Meals" }))
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(
      within(items[0] as HTMLElement).getByRole("button", { name: "Shared kitchen" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Internet" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
    expect(screen.queryByText("Is available for cooking.")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Shared kitchen" }))
    expect(screen.getByText("Is available for cooking.")).toBeTruthy()
  })
})
