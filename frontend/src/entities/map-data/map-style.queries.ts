import { type UseQueryResult, useQueries } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import type { BasemapAssets } from "@/shared/geo/basemap-labels"

export type MapStyleManifest = components["schemas"]["MapStyleManifest"]

const MANIFEST_STALE_MS = 5 * 60 * 1000

function basemapAssets(results: UseQueryResult<MapStyleManifest>[]): readonly BasemapAssets[] {
  return results.flatMap(({ data }) =>
    data?.available && data.assets
      ? [
          {
            regionId: data.region_id,
            basemapUrl: data.assets.basemap_url,
            glyphsUrl: data.assets.glyphs_url,
            spriteUrl: data.assets.sprite_url,
          },
        ]
      : [],
  )
}

export function useBasemaps(regionIds: readonly string[]): readonly BasemapAssets[] {
  return useQueries({
    queries: regionIds.map((regionId) => ({
      queryKey: ["map-style", regionId],
      queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
        unwrap(api.GET("/map/style", { signal, params: { query: { region_id: regionId } } })),
      staleTime: MANIFEST_STALE_MS,
      retry: false,
    })),
    combine: basemapAssets,
  })
}
