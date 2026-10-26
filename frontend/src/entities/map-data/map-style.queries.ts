import { type UseQueryResult, useQueries } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import type { BasemapAssets } from "@/shared/geo/basemap-labels"

export type MapStyleManifest = components["schemas"]["MapStyleManifest"]

const MANIFEST_STALE_MS = 5 * 60 * 1000

function styleQuery(regionId: string) {
  return {
    queryKey: ["map-style", regionId],
    queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
      unwrap(api.GET("/map/style", { signal, params: { query: { region_id: regionId } } })),
    staleTime: MANIFEST_STALE_MS,
    retry: false,
  }
}

function basemapAssets(results: UseQueryResult<MapStyleManifest>[]): readonly BasemapAssets[] {
  return results.flatMap(({ data }) =>
    data?.available && data.assets
      ? [
          {
            regionId: data.region_id,
            basemapUrl: data.assets.basemap_url,
            glyphsUrl: data.assets.glyphs_url,
            spriteUrl: data.assets.sprite_url,
            bbox: data.bbox,
            maxZoom: data.assets.max_zoom,
          },
        ]
      : [],
  )
}

export function useBasemaps(regionIds: readonly string[]): readonly BasemapAssets[] {
  return useQueries({
    queries: regionIds.map(styleQuery),
    combine: basemapAssets,
  })
}

function tileVersions(results: UseQueryResult<MapStyleManifest>[]): ReadonlyMap<string, string> {
  return new Map(
    results.flatMap(({ data }) =>
      data?.tiles_version ? [[data.region_id, data.tiles_version] as const] : [],
    ),
  )
}

export function useTileVersions(regionIds: readonly string[]): ReadonlyMap<string, string> {
  return useQueries({
    queries: regionIds.map(styleQuery),
    combine: tileVersions,
  })
}
