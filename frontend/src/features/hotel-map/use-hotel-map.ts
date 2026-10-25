import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef, useState } from "react"
import type { Camera, SearchResult } from "@/shared/api/hotel-types"
import { renderBasemap } from "@/shared/geo/basemap"
import { featureCollection } from "@/shared/geo/geometry"
import { geometryBounds } from "@/shared/geo/geometry-bounds"
import { renderBuildings, renderHighlights } from "@/shared/geo/map-layers"
import { renderTerrain, type SunPosition } from "@/shared/geo/terrain"
import { motionMs, useReducedMotion } from "@/shared/motion"
import { useMapColors } from "@/shared/theme"
import { useMapMarkers } from "./use-map-markers"

setWorkerUrl(workerUrl)
export interface MapData {
  readonly camera: Camera | undefined
  readonly buildings: readonly unknown[]
  readonly highlights: readonly unknown[]
  readonly bounds: readonly number[] | undefined
  readonly results: readonly SearchResult[]
  readonly hotelId: string | undefined
  readonly onSelect: (result: SearchResult) => void
  readonly focusFeatures: readonly unknown[]
  readonly focusLabel: string | undefined
  readonly sun: SunPosition
}
export function useHotelMap({
  camera,
  buildings,
  highlights,
  bounds,
  results,
  hotelId,
  onSelect,
  focusFeatures,
  focusLabel,
  sun,
}: MapData) {
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
      map.addControl(new NavigationControl({ showZoom: true, showCompass: true }), "top-right")
      map.addControl(new ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-right")
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
        paint: { "background-color": colors.sea },
      })
    renderTerrain(map, colors, sun)
    renderBasemap(map, colors)
    renderBuildings(map, featureCollection(buildings), color, accent)
    const highlight = focusFeatures.length ? colors.highlight : accent
    renderHighlights(map, featureCollection(highlights), highlight, colors.surface)
    map.setPaintProperty("buildings-volume", "fill-extrusion-color", [
      "case",
      ["boolean", ["get", "is_hotel"], false],
      accent,
      color,
    ])
    map.setPaintProperty("highlight-line", "line-color", highlight)
    map.setPaintProperty("highlight-line-casing", "line-color", colors.surface)
    map.setPaintProperty("highlight-area", "fill-color", highlight)
    map.setPaintProperty("highlight-point", "circle-color", highlight)
    map.setPaintProperty("highlight-point", "circle-stroke-color", colors.surface)
  }, [ready, buildings, highlights, focusFeatures, colors, sun])
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
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !bounds || bounds.length !== 4 || !bounds.every(Number.isFinite)) return
    const corners: [[number, number], [number, number]] = [
      [bounds[0] ?? 0, bounds[1] ?? 0],
      [bounds[2] ?? 0, bounds[3] ?? 0],
    ]
    map.stop()
    if (reduced) {
      const destination = map.cameraForBounds(corners)
      if (destination) map.jumpTo(destination)
    } else map.fitBounds(corners, { duration: motionMs("--dur-draw"), padding: 48 })
  }, [bounds, ready, reduced])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !hotelId || !focusFeatures.length) return
    const corners = geometryBounds(featureCollection(focusFeatures), camera?.center)
    if (!corners) return
    map.stop()
    map.fitBounds(corners, {
      padding: 72,
      maxZoom: 17,
      duration: reduced ? 0 : motionMs("--dur-draw"),
    })
  }, [ready, hotelId, focusFeatures, camera?.center, reduced])
  useMapMarkers({ mapRef: instance, ready, results, hotelId, onSelect, focusFeatures, focusLabel })
  return { container, instance, failed }
}
