import { useEffect, useMemo, useState } from "react"
import { useRegions } from "@/entities/catalog"
import {
  buildingIds,
  drawnVolumes,
  useBasemaps,
  useMapCatalog,
  useNightCity,
} from "@/entities/map-data"
import type { Camera, HotelSummary, SearchResult } from "@/shared/api/hotel-types"
import { readBuildingMaterial } from "@/shared/geo/appearance/materials"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import { appearanceClasses } from "@/shared/geo/appearance/palette"
import { useMapInstance } from "@/shared/geo/engine/use-map-instance"
import { useMapRendering } from "@/shared/geo/engine/use-map-rendering"
import { featureCollection } from "@/shared/geo/geometry"
import { renderHighlights } from "@/shared/geo/map-layers"
import { retainPmtiles } from "@/shared/geo/pmtiles-protocol"
import { followTerrainZoom, lightMode, type SunPosition } from "@/shared/geo/terrain"
import type { TexturedFootprint } from "@/shared/geo/textured-building/selection"
import { tintForTime } from "@/shared/geo/time-tint"
import { useLocale } from "@/shared/i18n"
import { useReducedMotion } from "@/shared/motion"
import { useMapAppearance, useMapColors } from "@/shared/theme"
import { useMapQuality } from "./quality/use-map-quality"
import { useMapCamera } from "./rendering/use-map-camera"
import { useRouteDraw } from "./rendering/use-route-draw"
import { useTexturedHotel } from "./texture/use-textured-hotel"
import { useMapMarkers } from "./use-map-markers"

export interface MapData {
  readonly previewing: boolean
  readonly visible: boolean
  readonly camera: Camera | undefined
  readonly buildings: readonly unknown[]
  readonly texturedFootprints: readonly TexturedFootprint[]
  readonly highlights: readonly unknown[]
  readonly bounds: readonly number[] | undefined
  readonly results: readonly SearchResult[]
  readonly location: HotelSummary | undefined
  readonly hotelId: string | undefined
  readonly focusFeatures: readonly unknown[]
  readonly focusLabel: string | undefined
  readonly sun: SunPosition
}

export function useHotelMap({
  visible,
  previewing,
  camera,
  buildings,
  texturedFootprints,
  highlights,
  bounds,
  results,
  hotelId,
  location,
  focusFeatures,
  focusLabel,
  sun,
}: MapData) {
  const {
    container,
    instance,
    ready,
    failed,
    active: observed,
  } = useMapInstance(camera !== undefined)
  const active = observed && visible
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
    () => appearanceClasses(appearance.id, catalog.data?.classes ?? [], colors, sun.altitude),
    [appearance.id, catalog.data, colors, sun.altitude],
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
  const rendering = useMapRendering(instance, ready, snapshot, active)
  const [route, setRoute] = useState<string>()
  useEffect(() => {
    const map = instance.current
    if (!active || !map) return
    const hasRoute = renderHighlights(map, highlightData, colors)
    setRoute(
      hasRoute ? JSON.stringify(highlightData.features.map((item) => item.geometry)) : undefined,
    )
  }, [instance, active, highlightData, colors])
  const buildingData = useMemo(() => featureCollection(buildings), [buildings])
  const buildingColors = useMemo(
    () =>
      tintForTime(
        colors,
        lightMode(sun.altitude),
        sun.altitude,
        APPEARANCES[appearance.id].materials.duskTint,
      ),
    [colors, sun.altitude, appearance.id],
  )
  const textureStatus = useTexturedHotel({
    mapRef: instance,
    ready: active,
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
  const quality = useMapQuality(instance, active)
  useNightCity({
    mapRef: instance,
    ready: active,
    regions: regionBoxes,
    drawn,
    textured,
    colors,
    volumeColor: classes.volume,
    sun,
    quality,
    effects: APPEARANCES[appearance.id].effects,
  })
  useRouteDraw(instance, route, colors, reduced, active)
  const terrain = quality < 3
  useEffect(() => {
    const map = instance.current
    if (!active || !map) return
    return followTerrainZoom(map, terrain)
  }, [instance, active, terrain])
  useMapCamera({
    map: instance,
    active,
    reduced,
    camera,
    bounds,
    hotelId,
    focusFeatures,
    previewing,
  })
  const markers = useMapMarkers({
    mapRef: instance,
    ready: active,
    results,
    hotelId,
    location,
    focusFeatures,
    focusLabel,
  })
  return {
    container,
    instance,
    ready,
    active,
    failed: failed || rendering.failed,
    markers,
    textureStatus,
  }
}
