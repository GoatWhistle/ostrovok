import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SupplierDetails } from "../../../src/features/hotel-details/supplier/supplier-details"
import type { components } from "../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

type Details = components["schemas"]["SupplierDetails"]

const SOURCE = "Ostrovok"
const metres = (value: number) => ru.supplier.metres.replace("{{value}}", String(value))
const kilometres = (value: string) => ru.supplier.kilometres.replace("{{value}}", value)

const DETAILS: Details = {
  supplier_id: "7374217",
  page_url: "https://ostrovok.ru/hotel/russia/sochi/mid7374217/zhemchuzhina_hotel_complex/",
  name: "Pearl Hotel Complex",
  address: "3 Seaside Street, Sochi",
  city: "Sochi",
  location: [39.732, 43.571],
  photos: [
    { url: "https://cdn.ostrovok.ru/t/1024x768/a.jpg", category: "Beach" },
    { url: "https://cdn.ostrovok.ru/t/1024x768/b.jpg", category: null },
  ],
  facts: {
    floors_number: 19,
    rooms_number: 881,
    star_rating: 4,
    year_built: 1973,
    year_renovated: 2007,
    kind: "RESORT",
    hotel_wifi: false,
    room_wifi: false,
    registry: {
      record: "R232024007508",
      name: null,
      address: null,
      link: "https://tourism.fsa.gov.ru/ru/resorts/hotels/5684b435/about-resort",
      categories: [{ category: "CT_FIRST_STANDARD", rooms: 736 }],
    },
  },
  amenity_groups: [
    {
      name: "Pool and beach",
      amenities: [
        { name: "Heated outdoor pool", free: true },
        { name: "Sun loungers", free: false },
      ],
    },
  ],
  description: [{ title: "Location", paragraphs: ["A hotel in Sochi."] }],
  nearby: [
    { name: "Pearl Beach", distance_m: 168, kind: "BEACH" },
    { name: "Sochi Arboretum", distance_m: 1400, kind: "PARK" },
  ],
  rating: { total: 7.9, reviews_count: 302, detailed: [{ name: "location", score: 9.4 }] },
  check_in_from: "15:00",
  check_out_until: "12:00",
  email: "stay@example.test",
  phone: "+78622661188",
}

function empty(): Details {
  return {
    ...DETAILS,
    photos: [],
    facts: {
      floors_number: null,
      rooms_number: null,
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
    rating: null,
    check_in_from: null,
    check_out_until: null,
  }
}

function show(details: Details) {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <SupplierDetails details={details} source={SOURCE} />
    </LocaleProvider>,
  )
}

describe("supplier details", () => {
  it("shows the published photos, facts and the register record", () => {
    show(DETAILS)
    expect(screen.getByRole("img").getAttribute("src")).toContain("a.jpg")
    expect(screen.getByLabelText(ru.supplier.photos)).toBeTruthy()
    expect(screen.getByText("19")).toBeTruthy()
    expect(screen.getByText("881")).toBeTruthy()
    expect(screen.getByText("1973")).toBeTruthy()
    expect(screen.getByText("15:00")).toBeTruthy()
    expect(screen.getByText(ru.supplier.registryLink).getAttribute("href")).toBe(
      DETAILS.facts.registry?.link,
    )
    expect(
      screen.getByText(ru.supplier.page.replace("{{source}}", SOURCE)).getAttribute("href"),
    ).toBe(DETAILS.page_url)
  })

  it("keeps supplier distances in metres and kilometres without inventing values", async () => {
    show(DETAILS)
    await userEvent.click(screen.getByText(ru.supplier.nearby.replace("{{count}}", "2")))
    const places = screen.getByText("Pearl Beach").closest("ul")
    expect(places).toBeTruthy()
    expect(within(places as HTMLElement).getByText(metres(168))).toBeTruthy()
    expect(within(places as HTMLElement).getByText(kilometres("1,4"))).toBeTruthy()
  })

  it("marks only the amenities the supplier declared free", async () => {
    show(DETAILS)
    await userEvent.click(screen.getByText(ru.supplier.amenities.replace("{{count}}", "2")))
    const free = screen.getByText("Heated outdoor pool")
    const paid = screen.getByText("Sun loungers")
    expect(free.querySelector("svg")).toBeTruthy()
    expect(paid.querySelector("svg")).toBeNull()
  })

  it("renders nothing invented when the supplier published no facts", () => {
    show(empty())
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByText(ru.supplier.registryLink)).toBeNull()
    expect(screen.queryByText(ru.supplier.about)).toBeNull()
    expect(screen.getByText(ru.supplier.page.replace("{{source}}", SOURCE))).toBeTruthy()
  })
})
