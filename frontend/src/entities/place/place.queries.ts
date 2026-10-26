import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"

export type PlaceCard = components["schemas"]["PlaceCard"]

export function usePlace(id: string, hotelId: string) {
  return useQuery({
    queryKey: ["place", id, hotelId],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/places/{place_id}", {
          signal,
          params: { path: { place_id: id }, query: { from_hotel: hotelId } },
        }),
      ),
    retry: false,
  })
}
