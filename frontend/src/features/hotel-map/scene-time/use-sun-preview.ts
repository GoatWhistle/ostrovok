import type { Map as MapLibreMap } from "maplibre-gl"
import { useCallback, useMemo, useState } from "react"
import { previewMapSun } from "@/shared/geo/appearance/controller"
import { sunScene } from "./scene-time"
import { createSunPreview } from "./sun-preview"

export interface SunPreviewInput {
  readonly date: string
  readonly hour: number
  readonly lat: number
  readonly lon: number
  readonly setHour: (hour: number) => void
}

function isSceneHour(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 23
}

export function useSunPreview({ date, hour, lat, lon, setHour }: SunPreviewInput) {
  const [preview] = useState(createSunPreview)
  const sun = useMemo(() => sunScene(date, hour, lat, lon), [date, hour, lat, lon])
  const scrub = useCallback(
    (map: MapLibreMap | null, value: number) => {
      const position = sunScene(date, value, lat, lon).position
      preview.set({ hour: value, position })
      previewMapSun(map, position)
    },
    [preview, date, lat, lon],
  )
  const commit = useCallback(
    (map: MapLibreMap | null, value: number) => {
      preview.set(null)
      if (!isSceneHour(value)) return
      if (value === hour) previewMapSun(map, undefined)
      else setHour(value)
    },
    [preview, hour, setHour],
  )
  return { sun, preview, scrub, commit }
}
