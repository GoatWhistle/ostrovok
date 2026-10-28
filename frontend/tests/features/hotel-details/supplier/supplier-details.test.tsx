import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SupplierDetails } from "../../../../src/features/hotel-details/supplier/supplier-details"
import type { components } from "../../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../../src/shared/i18n"
import ru from "../../../../src/shared/i18n/locales/ru/explore.json"

type Details = components["schemas"]["SupplierDetails"]

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
      name: ru.supplierAmenityGroup.poolBeach,
      amenities: [
        { name: ru.supplierAmenity.heatedOutdoorPool, free: true },
        { name: "Sun loungers", free: false },
      ],
    },
    {
      name: ru.supplierAmenityGroup.internet,
      amenities: [{ name: ru.supplierAmenity.freeWifi, free: true }],
    },
  ],
  description: [
    {
      title: "Location",
      paragraphs: [
        "A hotel in <b>Sochi</b>&nbsp;centre. The lobby has a bar. Guests use a private beach nearby.",
      ],
    },
    { title: "Rooms", paragraphs: ["Every room has a TV."] },
  ],
  nearby: [
    { name: "Sochi Arboretum", distance_m: 1400, kind: "PARK" },
    { name: "Pearl Beach", distance_m: 168, kind: "BEACH" },
    { name: "Park 3", distance_m: 2100, kind: "PARK" },
    { name: "Park 4", distance_m: 2200, kind: "PARK" },
    { name: "Park 5", distance_m: 2300, kind: "PARK" },
    { name: "Far Tower", distance_m: 15000, kind: "VIEWPOINT" },
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

function show(details: Details, wishes: readonly string[] = []) {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <SupplierDetails details={details} wishes={wishes} />
    </LocaleProvider>,
  )
}

describe("supplier details", () => {
  it("leaves the register record and the supplier page link out of the panel", () => {
    show(DETAILS)
    expect(screen.queryByText(/R232024007508/)).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("lists the nearest five places first with supplier distances", async () => {
    show(DETAILS)
    const places = screen.getByText("Pearl Beach").closest("ul") as HTMLElement
    expect(within(places).getAllByRole("listitem")).toHaveLength(5)
    expect(within(places).getAllByRole("listitem")[0]?.textContent).toContain(metres(168))
    expect(within(places).getByText(kilometres("1,4"))).toBeTruthy()
    expect(screen.queryByText("Far Tower")).toBeNull()
    await userEvent.click(screen.getByText(ru.supplier.moreNearby.replace("{{count}}", "1")))
    expect(screen.getByText("Far Tower")).toBeTruthy()
  })

  it("shows the useful amenities up front and the full grouped list on demand", async () => {
    show(DETAILS)
    expect(screen.getByText(ru.supplierAmenity.freeWifi)).toBeTruthy()
    expect(screen.queryByText("Sun loungers")).toBeNull()
    await userEvent.click(screen.getByText(ru.supplier.allAmenities.replace("{{count}}", "3")))
    expect(screen.getByText(ru.supplierAmenityGroup.poolBeach)).toBeTruthy()
    expect(screen.getByText("Sun loungers").parentElement?.textContent).not.toContain(
      ru.supplier.free,
    )
  })

  it("leads the description with sentences that match the wishes as plain text", async () => {
    const { container } = show(DETAILS, [ru.supplier.wishTopics.sea])
    const lead = container.querySelector("mark")?.closest("p")
    expect(lead?.textContent?.startsWith("Guests use a private beach nearby.")).toBe(true)
    expect(container.textContent).not.toContain("<b>")
    expect(screen.getByText(ru.supplier.aboutWish)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: ru.supplier.showMore }))
    expect(screen.getByText("Rooms")).toBeTruthy()
    expect(screen.getByRole("button", { name: ru.supplier.showLess })).toBeTruthy()
  })

  it("renders nothing invented when the supplier published no facts", () => {
    const { container } = show(empty())
    expect(container.textContent).toBe("")
  })
})
