import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useBasemaps, useMapCatalog } from "@/entities/map-data"
import type { Camera, SearchResult } from "@/shared/api/hotel-types"
import { renderBasemap } from "@/shared/geo/basemap"
import { renderBasemapLabels } from "@/shared/geo/basemap-labels"
import { classColors, renderCatalogLayers } from "@/shared/geo/catalog-layers"
import { featureCollection } from "@/shared/geo/geometry"
import { geometryBounds } from "@/shared/geo/geometry-bounds"
import { type HighlightColors, paintRoute, renderHighlights } from "@/shared/geo/map-layers"
import { retainPmtiles } from "@/shared/geo/pmtiles-protocol"
import {
  followTerrainZoom,
  lightMode,
  renderTerrain,
  type SunPosition,
  scenePalette,
} from "@/shared/geo/terrain"
import type { TexturedFootprint } from "@/shared/geo/textured-building/selection"
import { tintForTime } from "@/shared/geo/time-tint"
import { useLocale } from "@/shared/i18n"
import { motionMs, readEasing, useReducedMotion } from "@/shared/motion"
import { readTokenColors, useMapColors } from "@/shared/theme"
import { useTexturedHotel } from "./texture/use-textured-hotel"
import { useMapInstance } from "./use-map-instance"
import { useMapMarkers } from "./use-map-markers"

export interface MapData {
  readonly camera: Camera | undefined
  readonly buildings: readonly unknown[]
  readonly texturedFootprints: readonly TexturedFootprint[]
  readonly highlights: readonly unknown[]
  readonly bounds: readonly number[] | undefined
  readonly results: readonly SearchResult[]
  readonly hotelId: string | undefined
  readonly focusFeatures: readonly unknown[]
  readonly focusLabel: string | undefined
  readonly sun: SunPosition
}

function useRouteDraw(
  mapRef: RefObject<MapLibreMap | null>,
  route: string | undefined,
  colors: HighlightColors,
  reduced: boolean,
) {
  const palette = useRef(colors)
  const progress = useRef(1)
  useEffect(() => {
    palette.current = colors
    const map = mapRef.current
    if (map) paintRoute(map, colors, progress.current)
  }, [mapRef, colors])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !route) return
    progress.current = reduced ? 1 : 0
    paintRoute(map, palette.current, progress.current)
    if (reduced) return
    const effect = new KeyframeEffect(null, null, {
      duration: motionMs("--dur-draw"),
      easing: readEasing("--ease-in-out"),
      fill: "forwards",
    })
    const animation = new Animation(effect, document.timeline)
    let frame = 0
    const step = () => {
      progress.current = effect.getComputedTiming().progress ?? 1
      paintRoute(map, palette.current, progress.current)
      if (animation.playState !== "finished") frame = requestAnimationFrame(step)
    }
    animation.play()
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      animation.cancel()
      progress.current = 1
    }
  }, [mapRef, route, reduced])
}

type ViewApply = (instant: boolean) => void

function showView(
  view: RefObject<ViewApply | null>,
  map: MapLibreMap,
  reduced: boolean,
  apply: ViewApply,
) {
  view.current = apply
  map.stop()
  apply(reduced)
}

export function useHotelMap({
  camera,
  buildings,
  texturedFootprints,
  highlights,
  bounds,
  results,
  hotelId,
  focusFeatures,
  focusLabel,
  sun,
}: MapData) {
  const { container, instance, ready, failed, revealed } = useMapInstance(camera !== undefined)
  const reduced = useReducedMotion()
  const colors = useMapColors()
  const { locale } = useLocale()
  const regions = useRegions()
  const regionIds = useMemo(
    () => regions.data?.items?.flatMap((item) => (item.id ? [item.id] : [])) ?? [],
    [regions.data],
  )
  const basemaps = useBasemaps(regionIds)
  const catalog = useMapCatalog()
  const classes = useMemo(() => {
    const items = catalog.data?.classes ?? []
    const tokens = readTokenColors(items.map((item) => item.style.fill ?? ""))
    return classColors(items, (token) => tokens.get(token), {
      land: colors.land,
      building: colors.building,
      road: colors.road,
      park: colors.park,
    })
  }, [catalog.data, colors])
  useEffect(() => retainPmtiles(), [])
  const highlightData = useMemo(() => featureCollection(highlights), [highlights])
  const [route, setRoute] = useState<string>()
  useEffect(() => {
    const map = instance.current
    if (!ready || !map) return
    if (!map.getLayer("canvas"))
      map.addLayer({ id: "canvas", type: "background", paint: { "background-color": colors.sea } })
    const mode = lightMode(sun.altitude)
    const scene = tintForTime(colors, mode)
    renderTerrain(map, scene, sun)
    map
      .getContainer()
      .parentElement?.style.setProperty("--map-backdrop", scenePalette(scene, mode).sea)
    renderBasemap(map, scene)
    renderCatalogLayers(map, classes)
    const hasRoute = renderHighlights(map, highlightData, colors)
    renderBasemapLabels(map, basemaps, colors, locale)
    setRoute(
      hasRoute ? JSON.stringify(highlightData.features.map((item) => item.geometry)) : undefined,
    )
  }, [instance, ready, highlightData, colors, sun, basemaps, locale, classes])
  const buildingData = useMemo(() => featureCollection(buildings), [buildings])
  const buildingColors = useMemo(
    () => tintForTime(colors, lightMode(sun.altitude)),
    [colors, sun.altitude],
  )
  const textureStatus = useTexturedHotel({
    mapRef: instance,
    ready,
    hotelId,
    footprints: texturedFootprints,
    buildings: buildingData,
    colors: buildingColors,
    sun,
  })
  useRouteDraw(instance, ready ? route : undefined, colors, reduced)
  useEffect(() => {
    const map = instance.current
    if (!ready || !map) return
    return followTerrainZoom(map)
  }, [instance, ready])
  const view = useRef<ViewApply | null>(null)
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !camera?.center.every(Number.isFinite)) return
    const options = {
      center: [camera.center[0] ?? 0, camera.center[1] ?? 0] as [number, number],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
    }
    showView(view, map, reduced, (instant) => {
      if (instant) map.jumpTo(options)
      else map.flyTo({ ...options, duration: camera.duration_ms ?? motionMs("--dur-draw") })
    })
  }, [instance, camera, ready, reduced])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !bounds || bounds.length !== 4 || !bounds.every(Number.isFinite)) return
    const corners: [[number, number], [number, number]] = [
      [bounds[0] ?? 0, bounds[1] ?? 0],
      [bounds[2] ?? 0, bounds[3] ?? 0],
    ]
    showView(view, map, reduced, (instant) =>
      map.fitBounds(corners, { duration: instant ? 0 : motionMs("--dur-draw"), padding: 48 }),
    )
  }, [instance, bounds, ready, reduced])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || !hotelId || !focusFeatures.length) return
    const corners = geometryBounds(featureCollection(focusFeatures), camera?.center)
    if (!corners) return
    showView(view, map, reduced, (instant) =>
      map.fitBounds(corners, {
        padding: 72,
        maxZoom: 17,
        duration: instant ? 0 : motionMs("--dur-draw"),
      }),
    )
  }, [instance, ready, hotelId, focusFeatures, camera?.center, reduced])
  useEffect(() => {
    if (revealed > 0) view.current?.(true)
  }, [revealed])
  const markers = useMapMarkers({
    mapRef: instance,
    ready,
    results,
    hotelId,
    focusFeatures,
    focusLabel,
  })
  return { container, instance, ready, failed, markers, textureStatus }
}
