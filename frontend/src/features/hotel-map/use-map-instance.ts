import {
  type ErrorEvent,
  GPUInitializationError,
  Map as MapLibreMap,
  setWorkerUrl,
} from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef, useState } from "react"

setWorkerUrl(workerUrl)
const MAX_PIXEL_RATIO = 1.25
const ROTATE_SPEED = 0.35
const PITCH_SPEED = -0.25

function isFatalMapError(event: ErrorEvent, started: boolean): boolean {
  if (event.error instanceof GPUInitializationError) return true
  if ("sourceId" in event || "tile" in event) return false
  return !started
}

export function useMapInstance(hasCamera: boolean) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    if (!container.current || !hasCamera) return
    try {
      const map = new MapLibreMap({
        container: container.current,
        style: { version: 8, sources: {}, layers: [], transition: { duration: 0, delay: 0 } },
        attributionControl: false,
        maxPitch: 75,
        pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
        rotateSpeed: ROTATE_SPEED,
        pitchSpeed: PITCH_SPEED,
        fadeDuration: 0,
        renderWorldCopies: false,
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
      let visible = false
      const resize = new ResizeObserver(([entry]) => {
        map.resize()
        const shown = (entry?.contentRect.width ?? 0) > 0 && (entry?.contentRect.height ?? 0) > 0
        if (shown && !visible) setRevealed((count) => count + 1)
        visible = shown
      })
      resize.observe(container.current)
      return () => {
        resize.disconnect()
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
  }, [hasCamera])
  return { container, instance, ready, failed, revealed }
}
