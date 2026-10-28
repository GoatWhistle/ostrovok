import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"

const MIN_HOTELS = 2
const MAX_HOTELS = 5
const DETAILS_STALE_MS = 600_000

type Conversation = components["schemas"]["Conversation"]

export function useComparison(ids: readonly string[], conversationId?: string | null) {
  const cache = useQueryClient()
  const unique = [...new Set(ids)]
  const listed = unique.length > 0 && unique.length <= MAX_HOTELS
  const enabled = listed && unique.length >= MIN_HOTELS
  const conversation = useQuery({
    queryKey: ["conversation", conversationId ?? null],
    enabled: listed && Boolean(conversationId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/chat/conversations/{conversation_id}", {
          signal,
          params: { path: { conversation_id: conversationId ?? "" } },
        }),
      ),
    retry: false,
  })
  const searches = cache.getQueriesData<Conversation>({ queryKey: ["conversation"] })
  const matches = new Map(
    searches.flatMap(
      ([, data]) => data?.search?.results?.map((item) => [item.hotel.id, item] as const) ?? [],
    ),
  )
  for (const item of conversation.data?.search?.results ?? []) matches.set(item.hotel.id, item)
  const comparison = useQuery({
    queryKey: ["compare", unique],
    enabled,
    queryFn: ({ signal }) => unwrap(api.POST("/compare", { signal, body: { hotel_ids: unique } })),
    retry: false,
  })
  const hotels = useQueries({
    queries: unique.slice(0, MAX_HOTELS).map((id) => ({
      queryKey: ["hotel", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        unwrap(api.GET("/hotels/{hotel_id}", { signal, params: { path: { hotel_id: id } } })),
      enabled: listed,
      retry: false,
    })),
  })
  const details = useQueries({
    queries: unique.slice(0, MAX_HOTELS).map((id) => ({
      queryKey: ["hotel-details", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        unwrap(
          api.GET("/hotels/{hotel_id}/details", { signal, params: { path: { hotel_id: id } } }),
        ),
      enabled: listed,
      staleTime: DETAILS_STALE_MS,
      retry: false,
    })),
  })
  return {
    comparison,
    hotels,
    details,
    matches,
    intents: conversation.data?.search?.parsed?.intents ?? [],
    stay: conversation.data?.search?.parsed,
  }
}

export type ComparisonData = ReturnType<typeof useComparison>
