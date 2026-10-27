import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"

const CATALOG_STALE_MS = 5 * 60 * 1000

export function useMapCatalog() {
  return useQuery({
    queryKey: ["map-catalog"],
    queryFn: ({ signal }) => unwrap(api.GET("/map/catalog", { signal })),
    staleTime: CATALOG_STALE_MS,
    retry: false,
  })
}
