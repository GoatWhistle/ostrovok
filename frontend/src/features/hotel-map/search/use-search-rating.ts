import { useQueries } from "@tanstack/react-query"
import { hotelDetailsOptions } from "@/entities/hotel"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"

export function useSearchRating(journey: SearchJourney | undefined): SearchPreview | undefined {
  const hotels = journey?.finalists ?? []
  const enabled = Boolean(journey?.winner && !journey.winner.mode && !journey.sending)
  const queries = useQueries({
    queries: enabled ? hotels.map((hotel) => hotelDetailsOptions(hotel.id)) : [],
  })
  if (!enabled || queries.some((query) => query.isPending)) return undefined
  let best: SearchPreview | undefined
  for (const [index, query] of queries.entries()) {
    const hotel = hotels[index]
    const rating = query.data?.details?.rating?.total
    if (hotel && rating != null && rating > (best?.rating ?? -1)) best = { ...hotel, rating }
  }
  return best
}
