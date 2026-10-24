import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef, useState } from "react"
import type { Camera } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
import { renderBuildings, renderHighlights } from "@/shared/geo/map-layers"
import { motionMs, useReducedMotion } from "@/shared/motion"
import { useMapColors } from "@/shared/theme"

setWorkerUrl(workerUrl)
export interface MapData {
  readonly camera: Camera | undefined
  readonly buildings: readonly unknown[]
  readonly highlights: readonly unknown[]
}
export function useHotelMap({ camera, buildings, highlights }: MapData) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const reduced = useReducedMotion()
  const colors = useMapColors()
  const hasCamera = camera !== undefined
  useEffect(() => {
    if (!container.current || !hasCamera) return
    try {
      const map = new MapLibreMap({
        container: container.current,
        style: { version: 8, sources: {}, layers: [] },
        attributionControl: false,
      })
      instance.current = map
      const loaded = () => setReady(true)
      const error = () => setFailed(true)
      map.on("load", loaded)
      map.on("error", error)
      const resize = new ResizeObserver(() => map.resize())
      resize.observe(container.current)
      return () => {
        resize.disconnect()
        map.off("load", loaded)
        map.off("error", error)
        map.remove()
        instance.current = null
        setReady(false)
      }
    } catch {
      setFailed(true)
    }
    return undefined
  }, [hasCamera])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map) return
    const color = colors.building
    const accent = colors.accent
    if (!map.getLayer("canvas"))
      map.addLayer({
        id: "canvas",
        type: "background",
        paint: { "background-color": colors.surface },
      })
    renderBuildings(map, featureCollection(buildings), color, accent)
    renderHighlights(map, featureCollection(highlights), accent)
    map.setPaintProperty("canvas", "background-color", colors.surface)
    map.setPaintProperty("buildings-volume", "fill-extrusion-color", [
      "case",
      ["boolean", ["get", "is_hotel"], false],
      accent,
      color,
    ])
    map.setPaintProperty("highlight-line", "line-color", accent)
    map.setPaintProperty("highlight-area", "fill-color", accent)
    map.setPaintProperty("highlight-point", "circle-color", accent)
  }, [ready, buildings, highlights, colors])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !camera?.center.every(Number.isFinite)) return
    map.stop()
    const options = {
      center: [camera.center[0] ?? 0, camera.center[1] ?? 0] as [number, number],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
    }
    if (reduced) map.jumpTo(options)
    else
      map.flyTo({
        ...options,
        duration: camera.duration_ms ?? motionMs("--dur-draw"),
        essential: false,
      })
  }, [camera, ready, reduced])
  return { container, instance, failed }
}
