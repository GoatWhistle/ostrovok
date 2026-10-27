import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SupplierSection } from "../../../src/features/hotel-details/supplier/supplier-section"
import type { components } from "../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

type Offers = components["schemas"]["HotelOffers"]
type Room = components["schemas"]["SupplierRoom"]

const ROOMS: readonly Room[] = [
  {
    id: "group-1",
    name: "Standard",
    photos: ["https://cdn.ostrovok.ru/t/1024x768/room.jpg"],
    amenities: ["shower"],
    size_sqm: 17,
    bedding: "2 beds",
  },
]

const OFFERS: Offers = {
  hotel_id: "w51847429",
  check_in: "2026-11-20",
  check_out: "2026-11-23",
  adults: 2,
  status: "available",
  source: "Ostrovok",
  sandbox: false,
  checked_at: "2026-10-27T09:00:00Z",
  offers: [
    {
      id: "rate-1",
      room_name: "Standard",
      price_amount: 12000,
      price_currency: "RUB",
      available_rooms: 3,
      meal: "nomeal",
      amenities: [],
      floor_number: null,
      room_group_id: "group-1",
      free_cancellation_before: null,
    },
  ],
  facilities: [],
  room_categories: ["Standard"],
  photo_url: null,
  room_groups: ROOMS as Room[],
  rates_complete: true,
  details: null,
}

function show(content: Offers | undefined, dated: boolean) {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <SupplierSection
        hotelId="w51847429"
        rooms={ROOMS}
        content={content}
        stay={content ? "2026-11-20:2026-11-23:2" : "::0"}
        dated={dated}
      />
    </LocaleProvider>,
  )
}

describe("supplier section", () => {
  it("shows room categories and their photos before any dates are chosen", () => {
    const view = show(undefined, false)

    expect(screen.getByText("Standard")).toBeTruthy()
    expect(screen.getByText("2 beds")).toBeTruthy()
    expect(view.container.querySelector("img")?.getAttribute("src")).toContain("room.jpg")
    expect(screen.getByText(ru.rooms.needStay)).toBeTruthy()
    expect(screen.queryByText(ru.rooms.noRate)).toBeNull()
  })

  it("adds prices and drops the hint once the stay is known", () => {
    show(OFFERS, true)

    expect(screen.getByText("Standard")).toBeTruthy()
    expect(screen.queryByText(ru.rooms.needStay)).toBeNull()
    expect(screen.getByText(ru.offers.stayTotal)).toBeTruthy()
  })
})
