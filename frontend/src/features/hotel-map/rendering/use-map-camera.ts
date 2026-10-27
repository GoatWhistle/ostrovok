import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import type { Camera } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
import { geometryBounds } from "@/shared/geo/geometry-bounds"
import { motionMs } from "@/shared/motion"

interface CameraInput {
  readonly map: RefObject<MapLibreMap | null>
  readonly previewing?: boolean
  readonly active: boolean
  readonly reduced: boolean
  readonly camera: Camera | undefined
  readonly bounds: readonly number[] | undefined
  readonly hotelId: string | undefined
  readonly focusFeatures: readonly unknown[]
}

function useCameraCommand(
  map: RefObject<MapLibreMap | null>,
  active: boolean,
  key: string | undefined,
  apply: (instance: MapLibreMap) => void,
) {
  const applied = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!active) return
    if (!key) {
      applied.current = undefined
      return
    }
    if (!map.current || applied.current === key) return
    applied.current = key
    map.current.stop()
    apply(map.current)
  }, [map, active, key, apply])
}

function useOverviewAllowed(hotelId: string | undefined, bounds: readonly number[] | undefined) {
  const overview = useRef({ hotelId, bounds: JSON.stringify(bounds), suppressed: false })
  const boundsKey = JSON.stringify(bounds)
  if (overview.current.hotelId && !hotelId) overview.current.suppressed = true
  if (hotelId || (boundsKey && overview.current.bounds && boundsKey !== overview.current.bounds))
    overview.current.suppressed = false
  overview.current.hotelId = hotelId
  if (boundsKey) overview.current.bounds = boundsKey
  return !overview.current.suppressed
}

export function useMapCamera({
  map,
  active,
  reduced,
  previewing = false,
  camera,
  bounds,
  hotelId,
  focusFeatures,
}: CameraInput) {
  const overviewAllowed = useOverviewAllowed(hotelId, bounds)
  const validCamera = camera?.center.every(Number.isFinite) ? camera : undefined
  useCameraCommand(
    map,
    active && overviewAllowed,
    validCamera ? JSON.stringify(validCamera) : undefined,
    (instance) => {
      if (!validCamera) return
      const options = {
        center: [validCamera.center[0] ?? 0, validCamera.center[1] ?? 0] as [number, number],
        zoom: validCamera.zoom,
        pitch: validCamera.pitch,
        bearing: validCamera.bearing,
      }
      if (reduced) instance.jumpTo(options)
      else
        instance.flyTo({ ...options, duration: validCamera.duration_ms ?? motionMs("--dur-draw") })
    },
  )
  const validBounds = bounds?.length === 4 && bounds.every(Number.isFinite) ? bounds : undefined
  useCameraCommand(
    map,
    active && overviewAllowed,
    validBounds ? JSON.stringify(validBounds) : undefined,
    (instance) => {
      if (!validBounds) return
      instance.fitBounds(
        [
          [validBounds[0] ?? 0, validBounds[1] ?? 0],
          [validBounds[2] ?? 0, validBounds[3] ?? 0],
        ],
        { duration: reduced ? 0 : motionMs("--dur-draw"), padding: 48 },
      )
    },
  )
  const corners =
    hotelId && focusFeatures.length
      ? geometryBounds(featureCollection(focusFeatures), camera?.center)
      : undefined
  useCameraCommand(
    map,
    active && !previewing,
    corners ? JSON.stringify([hotelId, corners, camera?.center]) : undefined,
    (instance) => {
      if (corners)
        instance.fitBounds(corners, {
          padding: 72,
          maxZoom: 17,
          duration: reduced ? 0 : motionMs("--dur-draw"),
        })
    },
  )
}
