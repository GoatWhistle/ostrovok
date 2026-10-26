import { useMemo } from "react"
import { useGeoFeatures } from "@/entities/hotel"
import type { SearchResult } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"

export function useFocusGeometry(refs: readonly string[], hotel: SearchResult | undefined) {
  const base = useGeoFeatures(refs)
  const extraRefs = useMemo(() => {
    if (!hotel || refs.some((ref) => ref.startsWith("g_walk_"))) return []
    const [lon = 0, lat = 0] = hotel.hotel.location
    const scale = Math.cos((lat * Math.PI) / 180)
    return featureCollection(base.data?.features ?? [])
      .features.flatMap((feature) => {
        const id = String(feature.id).match(/^g_poi_([nwr]\d+)$/)?.[1]
        if (!id || feature.geometry.type !== "Point") return []
        const [x = lon, y = lat] = feature.geometry.coordinates
        return [{ id, distance: ((x - lon) * scale) ** 2 + (y - lat) ** 2 }]
      })
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
      .slice(0, 5)
      .map(({ id }) => `g_walk_${hotel.hotel.id}_${id}`)
  }, [refs, hotel, base.data])
  const walks = useGeoFeatures(extraRefs)
  const data = useMemo(
    () =>
      base.data
        ? {
            ...base.data,
            features: [...(base.data.features ?? []), ...(walks.data?.features ?? [])],
          }
        : undefined,
    [base.data, walks.data],
  )
  return {
    data,
    isError: base.isError || walks.isError,
    refetch: () => Promise.all([base.refetch(), ...(extraRefs.length ? [walks.refetch()] : [])]),
  }
}
