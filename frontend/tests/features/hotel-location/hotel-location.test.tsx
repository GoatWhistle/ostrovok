import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HotelLocation } from "@/features/hotel-location"
import { api } from "@/shared/api"
import type { HotelSummary } from "@/shared/api/hotel-types"
import copy from "@/shared/i18n/locales/ru/explore.json"

const hotel: HotelSummary = {
  id: "hotel-a",
  name: "Hotel A",
  address: "Sochi, Kurortny avenue 1",
  location: [39.72, 43.58],
}

function mount(summary: HotelSummary, staleTime = Number.POSITIVE_INFINITY) {
  const onOpenMap = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } })
  client.setQueryData(["hotel", summary.id], { hotel: summary })
  render(
    <QueryClientProvider client={client}>
      <HotelLocation hotelId={summary.id} geoRefs={[]} onOpenMap={onOpenMap} />
    </QueryClientProvider>,
  )
  return onOpenMap
}

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("hotel location", () => {
  it("shows the address and opens the large map without creating a hidden minimap", async () => {
    const open = mount(hotel)
    expect(screen.getByText(hotel.address as string)).toBeTruthy()
    expect(screen.getByRole("region", { name: copy.location.map })).toBeTruthy()
    expect(document.querySelector("[data-minimap-hotel]")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: copy.location.openMap }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it("reports missing coordinates honestly and offers no map action", () => {
    mount({ ...hotel, location: [Number.NaN, Number.NaN] })
    expect(screen.getByText(copy.location.noCoordinates)).toBeTruthy()
    expect(screen.queryByRole("button", { name: copy.location.openMap })).toBeNull()
    expect(document.querySelector("[data-minimap-hotel]")).toBeNull()
  })

  it("names the missing address instead of substituting a region", () => {
    mount({ ...hotel, address: null })
    expect(screen.getByText(copy.location.noAddress)).toBeTruthy()
  })

  it("keeps the known location when a background refresh fails", async () => {
    const get = vi.spyOn(api, "GET").mockRejectedValue(new TypeError("offline"))
    mount(hotel, 0)
    await waitFor(() => expect(get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByText(hotel.address as string)).toBeTruthy()
    expect(screen.getByRole("button", { name: copy.location.openMap })).toBeTruthy()
  })
})
