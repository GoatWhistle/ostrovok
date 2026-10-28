import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef, useState } from "react"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import {
  applyQuality,
  QualityGovernor,
  type QualityLevel,
  watchMovingFrames,
  watchRest,
} from "@/shared/geo/engine/map-quality"
import { useMapAppearance } from "@/shared/theme"

export function useMapQuality(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  night = false,
) {
  const [level, setLevel] = useState<QualityLevel>(0)
  const { id } = useMapAppearance()
  const governor = useRef<QualityGovernor | null>(null)
  const steady = APPEARANCES[id].effects.steadyLights
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const current = new QualityGovernor(setLevel)
    governor.current = current
    const unwatch = watchMovingFrames(map, (frame) => current.sample(frame))
    return () => {
      governor.current = null
      unwatch()
    }
  }, [mapRef, ready])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !steady) return
    return watchRest(map, () => governor.current?.rest())
  }, [mapRef, ready, steady])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const keyed = APPEARANCES[id].night !== undefined
    const apply = () => applyQuality(map, level, APPEARANCES[id].effects.roadGlow, night && keyed)
    apply()
    map.on("styledata", apply)
    map.on("zoom", apply)
    return () => {
      map.off("styledata", apply)
      map.off("zoom", apply)
    }
  }, [mapRef, ready, level, id, night])
  return level
}
