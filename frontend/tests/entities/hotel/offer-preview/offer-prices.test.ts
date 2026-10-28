import { describe, expect, it } from "vitest"
import {
  matchesOfferStay,
  minimumOffers,
} from "../../../../src/entities/hotel/offer-preview/offer-prices"
import type { components } from "../../../../src/shared/api/schema.gen"

type Offers = components["schemas"]["HotelOffers"]
function offer(
  price_amount: number,
  price_currency = "RUB",
  available_rooms: number | null = null,
) {
  return {
    id: String(price_amount),
    room_name: "Room",
    price_amount,
    price_currency,
    available_rooms,
    amenities: [],
  }
}
const content: Offers = {
  hotel_id: "hotel",
  status: "available",
  sandbox: false,
  rates_complete: true,
  check_in: "2026-11-10",
  check_out: "2026-11-12",
  adults: 2,
  offers: [],
}

describe("comparable room prices", () => {
  it("uses the minimum per currency without converting or selecting a sold out rate", () => {
    expect(
      minimumOffers({
        ...content,
        offers: [
          offer(4000),
          offer(2000),
          offer(0, "RUB", 0),
          offer(20, "EUR"),
          offer(15, "EUR"),
          offer(-1),
          offer(Number.NaN),
          offer(2, "invalid"),
        ],
      }).map((item) => [item.price_currency, item.price_amount]),
    ).toEqual([
      ["EUR", 15],
      ["RUB", 2000],
    ])
  })
  it("retains a zero price but excludes sandbox and unavailable replies", () => {
    expect(minimumOffers({ ...content, offers: [offer(0)] })[0]?.price_amount).toBe(0)
    expect(minimumOffers({ ...content, sandbox: true, offers: [offer(1)] })).toEqual([])
    expect(minimumOffers({ ...content, status: "provider_error", offers: [offer(1)] })).toEqual([])
  })
  it("rejects another stay or hotel even if its response arrives late", () => {
    expect(matchesOfferStay(content, "hotel", "2026-11-10", "2026-11-12", 2)).toBe(true)
    expect(matchesOfferStay(content, "hotel", "2026-11-11", "2026-11-12", 2)).toBe(false)
    expect(matchesOfferStay(content, "other", "2026-11-10", "2026-11-12", 2)).toBe(false)
    expect(matchesOfferStay(content, "hotel", "2026-11-10", "2026-11-12", 3)).toBe(false)
  })
})
