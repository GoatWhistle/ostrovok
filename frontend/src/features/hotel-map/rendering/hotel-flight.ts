import type { SearchResult } from "@/shared/api/hotel-types"
import { hotelPosition } from "../marker-view"
import { cameraZoom, FIT_MAX_ZOOM } from "./fit-zoom"

export const FLIGHT_PITCH = 55
export const FLIGHT_CURVE = 1.4

export interface HotelView {
  readonly center: [number, number]
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
}

export function hotelView(result: SearchResult, bearing: number): HotelView | undefined {
  const camera = result.camera
  if (camera?.center.every(Number.isFinite)) {
    return {
      center: [camera.center[0] ?? 0, camera.center[1] ?? 0],
      zoom: cameraZoom(camera.zoom),
      pitch: camera.pitch,
      bearing: camera.bearing,
    }
  }
  const center = hotelPosition(result)
  return center ? { center, zoom: FIT_MAX_ZOOM, pitch: FLIGHT_PITCH, bearing } : undefined
}
