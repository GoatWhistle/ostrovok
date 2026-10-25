import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api/client"

export function useWeather(lon: number, lat: number, date: string, hour: number, active: boolean) {
  return useQuery({
    queryKey: ["weather", lon, lat, date, hour],
    queryFn: () =>
      unwrap(
        api.GET("/weather", {
          params: { query: { lon, lat, date, hour } },
        }),
      ),
    enabled: active && Number.isFinite(lon) && Number.isFinite(lat),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
}
