import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, unwrap, useRecordMutation } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"

export type HotelierEntry = components["schemas"]["HotelierEntry"]
export type EntryInput = components["schemas"]["HotelierEntryInput"]

export function useHotelierEntries(hotelId: string) {
  return useQuery({
    queryKey: ["hotelier-entries", hotelId],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/hotelier/{hotel_id}/entries", {
          signal,
          params: { path: { hotel_id: hotelId } },
        }),
      ),
    retry: false,
  })
}

export function useSaveHotelierEntry(hotelId: string, entryId: string) {
  const cache = useQueryClient()
  return useRecordMutation(["hotelier-entry-write", hotelId, entryId], {
    mutationFn: (body: EntryInput) =>
      unwrap(
        api.PUT("/hotelier/{hotel_id}/entries/{entry_id}", {
          params: { path: { hotel_id: hotelId, entry_id: entryId } },
          body,
        }),
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["hotelier-entries", hotelId] }),
  })
}
