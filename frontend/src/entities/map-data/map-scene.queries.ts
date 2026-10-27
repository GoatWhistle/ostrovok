import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, api, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"

export type MapRenderScene = components["schemas"]["MapRenderScene"]

export interface SceneRequest {
  readonly regionId: string
  readonly bbox: readonly [number, number, number, number]
  readonly zoom: number
  readonly version: string | undefined
}

const SCENE_STALE_MS = 5 * 60 * 1000
const VERSION_CONFLICT = 409

export function useMapScene(request: SceneRequest | undefined) {
  const cache = useQueryClient()
  return useQuery({
    queryKey: [
      "map-scene",
      request?.regionId,
      request?.version,
      request?.bbox.join(","),
      request?.zoom,
    ],
    enabled: request !== undefined,
    queryFn: async ({ signal }) => {
      const query = {
        region_id: request?.regionId ?? "",
        bbox: request?.bbox.join(",") ?? "",
        zoom: request?.zoom ?? 0,
        ...(request?.version ? { v: request.version } : {}),
      }
      try {
        return await unwrap(api.GET("/map/scene", { signal, params: { query } }))
      } catch (error) {
        if (error instanceof ApiError && error.status === VERSION_CONFLICT)
          await cache.invalidateQueries({ queryKey: ["map-style"] })
        throw error
      }
    },
    retry: (count, error) =>
      error instanceof ApiError && error.status === VERSION_CONFLICT && count < 1,
    staleTime: SCENE_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
