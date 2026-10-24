import { useQueries, useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
export function useComparison(ids: readonly string[]) {
  const unique = [...new Set(ids)]
  const comparison = useQuery({
    queryKey: ["compare", unique],
    enabled: unique.length >= 2 && unique.length <= 5,
    queryFn: ({ signal }) => unwrap(api.POST("/compare", { signal, body: { hotel_ids: unique } })),
    retry: false,
  })
  const hotels = useQueries({
    queries: unique.slice(0, 5).map((id) => ({
      queryKey: ["hotel", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        unwrap(api.GET("/hotels/{hotel_id}", { signal, params: { path: { hotel_id: id } } })),
      enabled: unique.length >= 2 && unique.length <= 5,
      retry: false,
    })),
  })
  return {
    comparison,
    names: new Map(
      hotels.flatMap((hotel) =>
        hotel.data ? [[hotel.data.hotel.id, hotel.data.hotel.name] as const] : [],
      ),
    ),
  }
}
