import { queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { api, unwrap } from "@/shared/api"
import type { SearchRequest } from "@/shared/api/hotel-types"
import { RequestLane } from "@/shared/api/request-lane"
import { motionMs } from "@/shared/motion"

const offerRequests = new RequestLane(3)
const geometryRequests = new RequestLane(3)

export function useHotelSearch(request: SearchRequest | null) {
  return useInfiniteQuery({
    queryKey: ["search", request],
    enabled: request !== null,
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) =>
      unwrap(
        api.POST("/search", {
          signal,
          body: {
            query: request?.query ?? "",
            ...request,
            limit: request?.limit ?? 20,
            compute_missing: request?.compute_missing ?? true,
            cursor: pageParam,
          },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  })
}
export function useHotel(id: string | undefined) {
  return useQuery({
    queryKey: ["hotel", id],
    enabled: id !== undefined,
    queryFn: ({ signal }) =>
      unwrap(api.GET("/hotels/{hotel_id}", { signal, params: { path: { hotel_id: id ?? "" } } })),
    retry: false,
  })
}
export function useHotelOffers(
  id: string | undefined,
  checkIn: string,
  checkOut: string,
  adults: number,
) {
  const request = `${checkIn}:${checkOut}:${adults}`
  const [settled, setSettled] = useState(request)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(request), motionMs("--delay-offer-input"))
    return () => window.clearTimeout(timer)
  }, [request])
  return useQuery({
    queryKey: ["hotel-offers", id, checkIn, checkOut, adults, "ru"],
    enabled:
      settled === request &&
      id !== undefined &&
      checkIn !== "" &&
      checkOut !== "" &&
      checkOut > checkIn &&
      adults > 0,
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      offerRequests.run(signal, () =>
        unwrap(
          api.GET("/hotels/{hotel_id}/offers", {
            signal,
            params: {
              path: { hotel_id: id ?? "" },
              query: { check_in: checkIn, check_out: checkOut, adults, residency: "ru" },
            },
          }),
        ),
      ),
    retry: false,
  })
}
export function hotelDetailsKey(id: string | undefined) {
  return ["hotel-details", id] as const
}
export function hotelDetailsOptions(id: string | undefined) {
  return queryOptions({
    queryKey: hotelDetailsKey(id),
    enabled: id !== undefined,
    staleTime: 600_000,
    queryFn: ({ signal }) =>
      offerRequests.run(signal, () =>
        unwrap(
          api.GET("/hotels/{hotel_id}/details", {
            signal,
            params: { path: { hotel_id: id ?? "" } },
          }),
        ),
      ),
    retry: false,
  })
}
export function useHotelDetails(id: string | undefined) {
  return useQuery(hotelDetailsOptions(id))
}
export function useHotelScene(id: string | undefined) {
  return useQuery({
    queryKey: ["scene", id],
    enabled: id !== undefined,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/hotels/{hotel_id}/scene", {
          signal,
          params: { path: { hotel_id: id ?? "" }, query: { context_radius_m: 350 } },
        }),
      ),
    retry: false,
  })
}
export function useFact(hotel: string | undefined, fact: string | undefined) {
  return useQuery({
    queryKey: ["fact", hotel, fact],
    enabled: hotel !== undefined && fact !== undefined,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/hotels/{hotel_id}/facts/{fact_id}", {
          signal,
          params: { path: { hotel_id: hotel ?? "", fact_id: fact ?? "" } },
        }),
      ),
    retry: false,
  })
}
export function useGeoFeatures(ids: readonly string[]) {
  const normalized = [...new Set(ids)].sort()
  const chunks = Array.from({ length: Math.ceil(normalized.length / 200) }, (_, index) =>
    normalized.slice(index * 200, (index + 1) * 200),
  )
  return useQuery({
    queryKey: ["geometry", normalized],
    enabled: normalized.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: ({ signal }) =>
      Promise.all(
        chunks.map((ids) =>
          geometryRequests.run(signal, () =>
            unwrap(api.POST("/geo-features:batch", { signal, body: { ids } })),
          ),
        ),
      ),
    select: (replies) => ({
      type: "FeatureCollection" as const,
      features: replies.flatMap((reply) => reply.features ?? []),
    }),
    retry: false,
  })
}
