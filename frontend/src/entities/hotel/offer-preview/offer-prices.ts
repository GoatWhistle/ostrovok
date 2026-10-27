import type { components } from "@/shared/api/schema.gen"

type Offers = components["schemas"]["HotelOffers"]
type Offer = components["schemas"]["RoomOffer"]

export function minimumOffers(content: Offers | undefined): readonly Offer[] {
  if (content?.status !== "available" || content.sandbox) return []
  const currencies = new Map<string, Offer>()
  for (const offer of content.offers) {
    if (
      !Number.isFinite(offer.price_amount) ||
      offer.price_amount < 0 ||
      offer.available_rooms === 0 ||
      !/^[A-Z]{3}$/.test(offer.price_currency)
    )
      continue
    const previous = currencies.get(offer.price_currency)
    if (!previous || offer.price_amount < previous.price_amount)
      currencies.set(offer.price_currency, offer)
  }
  return [...currencies.values()].sort((a, b) => a.price_currency.localeCompare(b.price_currency))
}

export function matchesOfferStay(
  content: Offers | undefined,
  hotelId: string,
  checkIn: string,
  checkOut: string,
  adults: number,
): boolean {
  return (
    content?.hotel_id === hotelId &&
    content.check_in === checkIn &&
    content.check_out === checkOut &&
    content.adults === adults
  )
}
