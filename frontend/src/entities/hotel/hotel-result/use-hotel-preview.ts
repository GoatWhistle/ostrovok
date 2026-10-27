import { useQueryClient } from "@tanstack/react-query"
import type { components } from "@/shared/api/schema.gen"
import { hotelDetailsKey, useHotelDetails } from "../hotel.queries"

type Details = components["schemas"]["HotelDetails"]

export interface HotelPreview {
  readonly photos: readonly string[]
  readonly rating: number | undefined
  readonly reviews: number
  readonly stars: number | undefined
}

export function useHotelPreview(id: string, visible: boolean): HotelPreview {
  const query = useHotelDetails(visible ? id : undefined)
  const cached = useQueryClient().getQueryData<Details>(hotelDetailsKey(id))
  const supplier = (query.data ?? cached)?.details ?? undefined
  return {
    photos: (supplier?.photos ?? []).map((photo) => photo.url),
    rating: supplier?.rating?.total ?? undefined,
    reviews: supplier?.rating?.reviews_count ?? 0,
    stars: supplier?.facts.star_rating ?? undefined,
  }
}
