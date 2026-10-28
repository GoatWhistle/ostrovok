import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useState } from "react"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import {
  applyQuality,
  QualityGovernor,
  type QualityLevel,
  watchMovingFrames,
} from "@/shared/geo/engine/map-quality"
import { useMapAppearance } from "@/shared/theme"

export function useMapQuality(mapRef: RefObject<MapLibreMap | null>, ready: boolean) {
  const [level, setLevel] = useState<QualityLevel>(0)
  const { id } = useMapAppearance()
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const governor = new QualityGovernor(setLevel)
    return watchMovingFrames(map, (frame) => governor.sample(frame))
  }, [mapRef, ready])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const apply = () => applyQuality(map, level, APPEARANCES[id].effects.roadGlow)
    apply()
    map.on("styledata", apply)
    map.on("zoom", apply)
    return () => {
      map.off("styledata", apply)
      map.off("zoom", apply)
    }
  }, [mapRef, ready, level, id])
  return level
}
