import type { FitBoundsOptions } from "maplibre-gl"

export const FIT_MAX_ZOOM = 16.5

export function fitOptions(options: FitBoundsOptions): FitBoundsOptions {
  return { ...options, maxZoom: Math.min(options.maxZoom ?? FIT_MAX_ZOOM, FIT_MAX_ZOOM) }
}

export const CAMERA_MAX_ZOOM = 18

export function cameraZoom(zoom: number): number {
  return Math.min(zoom, CAMERA_MAX_ZOOM)
}

export const CLUSTER_MIN_STEP = 2

export function clusterZoom(expansion: number, current: number, max: number): number {
  return Math.min(Math.max(expansion, current + CLUSTER_MIN_STEP), max, FIT_MAX_ZOOM)
}
