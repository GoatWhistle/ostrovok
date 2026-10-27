import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useBasemaps, useMapCatalog } from "@/entities/map-data"
import type { Camera, SearchResult } from "@/shared/api/hotel-types"
import { readBuildingMaterial } from "@/shared/geo/appearance/materials"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import { appearanceClasses } from "@/shared/geo/appearance/palette"
import { featureCollection } from "@/shared/geo/geometry"
import { geometryBounds } from "@/shared/geo/geometry-bounds"
import { renderHighlights } from "@/shared/geo/map-layers"
import { retainPmtiles } from "@/shared/geo/pmtiles-protocol"
import { followTerrainZoom, lightMode, type SunPosition } from "@/shared/geo/terrain"
import type { TexturedFootprint } from "@/shared/geo/textured-building/selection"
import { tintForTime } from "@/shared/geo/time-tint"
import { useLocale } from "@/shared/i18n"
import { motionMs, useReducedMotion } from "@/shared/motion"
import { useMapAppearance, useMapColors } from "@/shared/theme"
import { buildingIds, drawnVolumes } from "./night-city/night-city-data"
import { useNightCity } from "./night-city/use-night-city"
import { useMapQuality } from "./quality/use-map-quality"
import { useMapRendering } from "./rendering/use-map-rendering"
import { useRouteDraw } from "./rendering/use-route-draw"
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
  const appearance = useMapAppearance()
  const material = useMemo(() => readBuildingMaterial(appearance.id), [appearance.id])
  const { locale } = useLocale()
  const regions = useRegions()
  const regionIds = useMemo(
    () => regions.data?.items?.flatMap((item) => (item.id ? [item.id] : [])) ?? [],
    [regions.data],
  )
  const basemaps = useBasemaps(regionIds)
  const catalog = useMapCatalog()
  const classes = useMemo(
    () => appearanceClasses(appearance.id, catalog.data?.classes ?? [], colors),
    [appearance.id, catalog.data, colors],
  )
  useEffect(() => retainPmtiles(), [])
  const highlightData = useMemo(() => featureCollection(highlights), [highlights])
  const snapshot = useMemo(
    () => ({
      catalog: catalog.data?.classes ?? [],
      assets: basemaps,
      locale,
      sun,
      excluded: buildingIds(buildings),
    }),
    [catalog.data, basemaps, locale, sun, buildings],
  )
  const rendering = useMapRendering(instance, ready, snapshot)
  const [route, setRoute] = useState<string>()
  useEffect(() => {
    const map = instance.current
    if (!ready || !map) return
    const hasRoute = renderHighlights(map, highlightData, colors)
    setRoute(
      hasRoute ? JSON.stringify(highlightData.features.map((item) => item.geometry)) : undefined,
    )
  }, [instance, ready, highlightData, colors])
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
    material,
    sun,
  })
  const regionBoxes = useMemo(
    () =>
      regions.data?.items?.flatMap((item) =>
        item.id && item.bbox ? [{ id: item.id, bbox: item.bbox }] : [],
      ) ?? [],
    [regions.data],
  )
  const drawn = useMemo(() => drawnVolumes(buildings), [buildings])
  const textured = useMemo(() => new Set(buildingIds(texturedFootprints)), [texturedFootprints])
  const quality = useMapQuality(instance, ready)
  useNightCity({
    mapRef: instance,
    ready,
    regions: regionBoxes,
    drawn,
    textured,
    colors,
    volumeColor: classes.volume,
    sun,
    quality,
    effects: APPEARANCES[appearance.id].effects,
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
  return { container, instance, ready, failed: failed || rendering.failed, markers, textureStatus }
}
