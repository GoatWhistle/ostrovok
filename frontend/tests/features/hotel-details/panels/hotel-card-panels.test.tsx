import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { hotelDetailsKey } from "../../../../src/entities/hotel/hotel.queries"
import { HotelCardPanels } from "../../../../src/features/hotel-details/panels/hotel-card-panels"
import type { components } from "../../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../../src/shared/i18n"
import ru from "../../../../src/shared/i18n/locales/ru/explore.json"

const card: components["schemas"]["HotelCard"] = {
  hotel: { id: "one", name: "Hotel", location: [39.7, 43.6] },
  facilities_ru: ["Wi-Fi"],
  facts: [
    {
      fact_id: "pets",
      characteristic_key: "pets_policy",
      value: { allowed: true, fee_rub: 500 },
      label: "Pets",
      subject: "hotel:one",
      confidence: 1,
      source_type: "hotelier",
      status: "confirmed_by_hotelier",
    },
  ],
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(hotelDetailsKey("one"), {
    hotel_id: "one",
    status: "hotel_unmapped",
    source: "Supplier",
    sandbox: false,
    details: null,
    room_groups: [],
  })
  const onFact = vi.fn()
  const view = (data: typeof card) => (
    <QueryClientProvider client={client}>
      <LocaleProvider instance={createI18n("ru")}>
        <HotelCardPanels card={data} supplier={undefined} onFact={onFact} onRooms={vi.fn()} />
      </LocaleProvider>
    </QueryClientProvider>
  )
  return { ...render(view(card)), view, onFact }
}

describe("hotel card panels", () => {
  it("orders the sections and opens the real surcharge evidence", async () => {
    const { onFact } = setup()
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      ru.hotelCard.about,
      ru.hotelCard.nearby,
      ru.hotelCard.amenities,
      ru.hotelCard.paid,
    ])
    await userEvent.click(screen.getByRole("tab", { name: ru.hotelCard.paid }))
    expect(screen.getByText(/\+500/)).toBeTruthy()
    expect(screen.getByText(ru.hotelCard.periodUnknown)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /500/ }))
    expect(onFact).toHaveBeenCalledWith(card.facts[0])
  })

  it("hides paid services and returns to About when the charge disappears", async () => {
    const { rerender, view } = setup()
    await userEvent.click(screen.getByRole("tab", { name: ru.hotelCard.paid }))
    rerender(view({ ...card, facts: [] }))
    expect(screen.queryByRole("tab", { name: ru.hotelCard.paid })).toBeNull()
    expect(
      screen.getByRole("tab", { name: ru.hotelCard.about }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(screen.queryByText(/\+500/)).toBeNull()
    rerender(view(card))
    expect(
      screen.getByRole("tab", { name: ru.hotelCard.about }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  it("keeps missing nearby data separate from amenities and navigates with arrow keys", async () => {
    setup()
    await userEvent.click(screen.getByRole("tab", { name: ru.hotelCard.nearby }))
    expect(screen.getByText(ru.hotelCard.nearbyEmpty)).toBeTruthy()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: ru.hotelCard.amenities })).toBe(document.activeElement)
    await userEvent.click(screen.getByRole("button", { name: ru.supplierAmenityGroup.general }))
    expect(screen.getByText("Wi-Fi")).toBeTruthy()
    expect(screen.queryByText(ru.hotelCard.nearbyEmpty)).toBeNull()
  })
})
