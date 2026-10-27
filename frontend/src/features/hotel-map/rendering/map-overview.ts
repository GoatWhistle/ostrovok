import type { Map as MapLibreMap } from "maplibre-gl"
import type { Camera, SearchResult } from "@/shared/api/hotel-types"
import { motionMs } from "@/shared/motion"
import { resultCorners } from "../scene-data"

export function showMapOverview(
  map: MapLibreMap | null,
  overview: Camera | undefined,
  hotelId: string | undefined,
  results: readonly SearchResult[],
  instant: boolean,
) {
  if (!map) return
  const corners = hotelId ? undefined : resultCorners(results)
  const duration = instant ? 0 : motionMs("--dur-draw")
  if (corners) {
    map.fitBounds(corners, { duration, padding: 64, maxZoom: 15 })
    return
  }
  if (!overview) return
  const options = {
    center: [overview.center[0] ?? 0, overview.center[1] ?? 0] as [number, number],
    zoom: overview.zoom,
    bearing: overview.bearing,
    pitch: overview.pitch,
  }
  if (instant) map.jumpTo(options)
  else map.flyTo({ ...options, duration })
}
