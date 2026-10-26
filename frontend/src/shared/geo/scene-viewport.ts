import type { Map as MapLibreMap } from "maplibre-gl"

export interface SceneViewport {
  readonly center: readonly [number, number]
  readonly bbox: readonly [number, number, number, number]
  readonly zoom: number
}

const MIN_SCENE_ZOOM = 16
const HALF_SIDE_KM = 0.8
const GRID_DEGREES = 0.002
const KM_PER_DEGREE = 111.32
const SETTLE_MS = 150

function snap(value: number, up: boolean) {
  const steps = value / GRID_DEGREES
  return Number(((up ? Math.ceil(steps) : Math.floor(steps)) * GRID_DEGREES).toFixed(6))
}

export function sceneArea(
  center: readonly [number, number],
  zoom: number,
): SceneViewport | undefined {
  if (zoom < MIN_SCENE_ZOOM) return undefined
  const [lon, lat] = center
  const halfLat = HALF_SIDE_KM / KM_PER_DEGREE
  const halfLon = halfLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return {
    center,
    bbox: [
      snap(lon - halfLon, false),
      snap(lat - halfLat, false),
      snap(lon + halfLon, true),
      snap(lat + halfLat, true),
    ],
    zoom: Math.min(19, Math.floor(zoom)),
  }
}

export function watchSceneViewport(
  map: MapLibreMap,
  onChange: (viewport: SceneViewport | undefined) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const emit = () => {
    const center = map.getCenter()
    onChange(sceneArea([center.lng, center.lat], map.getZoom()))
  }
  const settle = () => {
    clearTimeout(timer)
    timer = setTimeout(emit, SETTLE_MS)
  }
  map.on("moveend", settle)
  emit()
  return () => {
    clearTimeout(timer)
    map.off("moveend", settle)
  }
}
