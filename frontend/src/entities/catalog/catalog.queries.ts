import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: ({ signal }) => unwrap(api.GET("/regions", { signal })),
    retry: false,
  })
}
export function useCharacteristics() {
  return useQuery({
    queryKey: ["characteristics"],
    queryFn: ({ signal }) => unwrap(api.GET("/characteristics", { signal })),
    retry: false,
  })
}
