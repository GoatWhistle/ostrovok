import type { Map as MapLibreMap } from "maplibre-gl"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"

export function flyToSearchScene(
  instance: MapLibreMap,
  scene: SearchPreview,
  duration: number,
  easing: (value: number) => number,
) {
  const coordinates = scene.route?.coordinates ?? []
  const points = [scene.location, ...coordinates].filter(
    (point) => point.length === 2 && point.every(Number.isFinite),
  )
  const lng = points.map((point) => point[0] ?? 0)
  const lat = points.map((point) => point[1] ?? 0)
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lng), Math.min(...lat)],
    [Math.max(...lng), Math.max(...lat)],
  ]
  const target = instance.cameraForBounds(bounds, { padding: 96, maxZoom: 17 })
  instance.flyTo({
    ...target,
    center: target?.center ?? [scene.location[0] ?? 0, scene.location[1] ?? 0],
    zoom: target?.zoom ?? 17,
    pitch: 35,
    bearing: 0,
    duration,
    easing,
    essential: false,
  })
}

export function flyToSearchArea(
  instance: MapLibreMap,
  journey: SearchJourney,
  duration: number,
  easing: (value: number) => number,
) {
  const bounds = journey.bounds
  if (!journey.location || bounds?.length !== 4 || !bounds.every(Number.isFinite)) return false
  instance.fitBounds(
    [
      [bounds[0] ?? 0, bounds[1] ?? 0],
      [bounds[2] ?? 0, bounds[3] ?? 0],
    ],
    { padding: 64, maxZoom: 14, duration, easing },
  )
  return true
}
