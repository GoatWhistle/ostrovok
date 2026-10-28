import {
  type ErrorEvent,
  GPUInitializationError,
  Map as MapLibreMap,
  type MapOptions,
  setWorkerUrl,
} from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef, useState } from "react"
import { FULL_PIXEL_RATIO } from "@/shared/geo/engine/map-quality"
import { watchMapVisibility } from "./watch-map-visibility"

setWorkerUrl(workerUrl)
const ROTATE_SPEED = 0.35
const PITCH_SPEED = -0.25
const MIN_ZOOM = 2

function isFatalMapError(event: ErrorEvent, started: boolean): boolean {
  if (event.error instanceof GPUInitializationError) return true
  if ("sourceId" in event || "tile" in event) return false
  return !started
}

const DEFAULT_OPTIONS = {}

export function useMapInstance(
  hasCamera: boolean,
  options: Partial<Omit<MapOptions, "container" | "style">> = DEFAULT_OPTIONS,
) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)
  const initialized = useRef(false)
  initialized.current ||= hasCamera
  const enabled = initialized.current
  useEffect(() => {
    if (!container.current || !enabled) return
    try {
      const map = new MapLibreMap({
        container: container.current,
        style: { version: 8, sources: {}, layers: [], transition: { duration: 0, delay: 0 } },
        attributionControl: false,
        trackResize: false,
        maxPitch: 75,
        minZoom: MIN_ZOOM,
        pixelRatio: Math.min(window.devicePixelRatio, FULL_PIXEL_RATIO),
        canvasContextAttributes: { antialias: true },
        rotateSpeed: ROTATE_SPEED,
        pitchSpeed: PITCH_SPEED,
        fadeDuration: 0,
        renderWorldCopies: false,
        ...options,
      })
      instance.current = map
      let started = false
      const loaded = () => {
        started = true
        setReady(true)
      }
      const error = (event: ErrorEvent) => {
        if (isFatalMapError(event, started)) setFailed(true)
      }
      const lost = () => setFailed(true)
      const restored = () => setFailed(false)
      map.on("load", loaded)
      map.on("error", error)
      map.on("webglcontextlost", lost)
      map.on("webglcontextrestored", restored)
      const unwatch = watchMapVisibility(map, setVisible)
      return () => {
        unwatch()
        map.off("load", loaded)
        map.off("error", error)
        map.off("webglcontextlost", lost)
        map.off("webglcontextrestored", restored)
        map.remove()
        instance.current = null
        setReady(false)
      }
    } catch {
      setFailed(true)
    }
    return undefined
  }, [enabled, options])
  return { container, instance, ready, failed, active: ready && visible && !failed }
}
