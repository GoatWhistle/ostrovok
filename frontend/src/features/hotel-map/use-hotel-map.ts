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
import type { SearchJourney } from "@/shared/api/search-journey"
import { readBuildingMaterial } from "@/shared/geo/appearance/materials"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import { appearanceClasses, readNightColors, tintedColors } from "@/shared/geo/appearance/palette"
import { retainPmtiles } from "@/shared/geo/basemap/pmtiles-protocol"
import { renderHighlights } from "@/shared/geo/buildings/map-layers"
import { useMapInstance } from "@/shared/geo/engine/use-map-instance"
import { useMapRendering } from "@/shared/geo/engine/use-map-rendering"
import { featureCollection } from "@/shared/geo/geometry/geometry"
import { nightFactor } from "@/shared/geo/night-city/night-layers"
import { followTerrainZoom, type SunPosition } from "@/shared/geo/terrain/terrain"
import type { TexturedFootprint } from "@/shared/geo/textured-building/selection"
import { useLocale } from "@/shared/i18n"
import { useReducedMotion } from "@/shared/motion"
import { useMapAppearance, useMapColors } from "@/shared/theme"
import { useMapQuality } from "./quality/use-map-quality"
import { useMapCamera } from "./rendering/use-map-camera"
import { useRouteDraw } from "./rendering/use-route-draw"
import { useCandidatePins } from "./search/use-candidate-pins"
import { useSearchAppearance } from "./search/use-search-appearance"
import { useSearchCamera } from "./search/use-search-camera"
import { useSearchTour } from "./search/use-search-tour"
import { useTexturedHotel } from "./texture/use-textured-hotel"
import { useMapMarkers } from "./use-map-markers"

export interface MapData {
  readonly journey: SearchJourney | undefined
  readonly onCandidate: (id: string) => void
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
  journey,
  onCandidate,
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
  const chosen = useMapAppearance()
  const override = useSearchAppearance(journey, chosen.id)
  const colors = useMapColors(override)
  const appearance = { id: override ?? chosen.id }
  const material = useMemo(() => readBuildingMaterial(appearance.id), [appearance.id])
  const { locale } = useLocale()
  const regions = useRegions()
  const regionIds = useMemo(
    () => regions.data?.items?.flatMap((item) => (item.id ? [item.id] : [])) ?? [],
    [regions.data],
  )
  const basemaps = useBasemaps(regionIds)
  const catalog = useMapCatalog()
  const night = useMemo(() => readNightColors(appearance.id), [appearance.id])
  const classes = useMemo(
    () =>
      appearanceClasses(appearance.id, catalog.data?.classes ?? [], colors, night, sun.altitude),
    [appearance.id, catalog.data, colors, night, sun.altitude],
  )
  useEffect(() => retainPmtiles(), [])
  const searchScene = useSearchTour(journey, reduced)
  const highlightData = useMemo(
    () =>
      featureCollection(
        (!hotelId || journey?.sending) && searchScene?.route
          ? [
              {
                type: "Feature",
                geometry: searchScene.route,
                properties: { kind: "route", mode: searchScene.mode },
              },
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: searchScene.route.coordinates.at(-1) },
                properties: { kind: "place" },
              },
            ]
          : highlights,
      ),
    [highlights, hotelId, searchScene, journey?.sending],
  )
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
  const rendering = useMapRendering(instance, ready, snapshot, active, "main", override)
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
    () => tintedColors(appearance.id, colors, night, sun.altitude),
    [colors, night, sun.altitude, appearance.id],
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
  const quality = useMapQuality(instance, active, nightFactor(sun.altitude) > 0)
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
  useRouteDraw(
    instance,
    route,
    colors,
    reduced,
    active,
    Boolean(searchScene?.route && (!hotelId || journey?.sending)),
  )
  const terrain = quality < 3
  useEffect(() => {
    const map = instance.current
    if (!active || !map) return
    return followTerrainZoom(map, terrain)
  }, [instance, active, terrain])
  useSearchCamera(instance, active, journey, Boolean(hotelId), reduced, searchScene)
  useCandidatePins(instance, active, journey, colors, onCandidate, searchScene?.id)
  useMapCamera({
    map: instance,
    active: active && (!journey || (Boolean(hotelId) && !journey.sending)),
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
    results:
      searchScene && !hotelId
        ? results.filter((item) => item.hotel.id !== searchScene.id)
        : results,
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
    searchScene: hotelId && !journey?.sending ? undefined : searchScene,
  }
}
