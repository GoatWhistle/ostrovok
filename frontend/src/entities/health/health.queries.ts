import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"

export const HEALTH_PATH = "/health"

export const healthKeys = {
  all: ["health"] as const,
}

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: ({ signal }) => unwrap(api.GET(HEALTH_PATH, { signal })),
    retry: false,
  })
}
