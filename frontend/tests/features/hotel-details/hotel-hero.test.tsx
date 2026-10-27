import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HotelHero } from "../../../src/features/hotel-details/hotel-hero"
import type { HotelSummary } from "../../../src/shared/api/hotel-types"
import type { components } from "../../../src/shared/api/schema.gen"
import { LocaleProvider } from "../../../src/shared/i18n/locale-provider"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

type Supplier = components["schemas"]["SupplierDetails"]

const HOTEL: HotelSummary = { id: "w1", name: "777", location: [39.7, 43.5], photos: [] }

const SUPPLIER: Supplier = {
  supplier_id: "1",
  page_url: "https://ostrovok.ru/hotel/1/",
  name: "777",
  photos: [
    { url: "https://cdn.ostrovok.ru/t/1024x768/a.jpg", category: null },
    { url: "https://cdn.ostrovok.ru/t/1024x768/b.jpg", category: null },
  ],
  facts: {
    floors_number: null,
    rooms_number: 27,
    star_rating: null,
    year_built: null,
    year_renovated: null,
    kind: null,
    hotel_wifi: null,
    room_wifi: null,
    registry: null,
  },
  amenity_groups: [],
  description: [],
  nearby: [],
  rating: { total: 6.8, reviews_count: 18, detailed: [] },
  check_in_from: "13:00",
  check_out_until: "12:00",
}

function show(supplier: Supplier | undefined) {
  return render(
    <LocaleProvider>
      <HotelHero hotel={HOTEL} supplier={supplier} titleId="title" onRooms={undefined} />
    </LocaleProvider>,
  )
}

describe("hotel hero", () => {
  it("leads with the supplier photos and the stay facts", () => {
    show(SUPPLIER)
    expect(screen.getByRole("img").getAttribute("src")).toContain("a.jpg")
    fireEvent.click(screen.getByRole("button", { name: ru.rooms.nextPhoto }))
    expect(screen.getByRole("img").getAttribute("src")).toContain("b.jpg")
    expect(screen.getByText(ru.hotelCover.checkIn.replace("{{time}}", "13:00"))).toBeTruthy()
    expect(screen.getByText(ru.hotelCover.checkOut.replace("{{time}}", "12:00"))).toBeTruthy()
    expect(screen.getByText(/6,8/)).toBeTruthy()
    expect(screen.getByText(/27/)).toBeTruthy()
  })

  it("shows no cover and no invented facts without supplier data", () => {
    show(undefined)
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByText(/13:00/)).toBeNull()
    expect(screen.queryByRole("button", { name: ru.offers.viewRooms })).toBeNull()
  })
})
