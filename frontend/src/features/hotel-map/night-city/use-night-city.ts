import type { FeatureCollection } from "geojson"
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useMapScene, useTileVersions } from "@/entities/map-data"
import { labelAnchor } from "@/shared/geo/basemap-labels"
import {
  nightFactor,
  renderNightLights,
  renderSceneVolumes,
  windowFade,
} from "@/shared/geo/night-city/night-layers"
import { WindowBuilder } from "@/shared/geo/night-city/window-builder"
import { WINDOW_LAYER, WindowLayer } from "@/shared/geo/night-city/window-layer"
import { type SceneViewport, watchSceneViewport } from "@/shared/geo/scene-viewport"
import type { SunPosition } from "@/shared/geo/terrain"
import type { MapColors } from "@/shared/theme"
import { type RegionBox, regionFor, rgb, windowBuildings } from "./night-city-data"

export interface NightCityInput {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly regions: readonly RegionBox[]
  readonly excluded: readonly string[]
  readonly colors: MapColors
  readonly volumeColor: ExpressionSpecification | string
  readonly sun: SunPosition
}

function useWindowLayer(mapRef: RefObject<MapLibreMap | null>, ready: boolean) {
  const layer = useRef<WindowLayer | null>(null)
  const builder = useRef<WindowBuilder | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const current = new WindowLayer()
    const worker = new WindowBuilder()
    map.addLayer(current, labelAnchor(map))
    layer.current = current
    builder.current = worker
    return () => {
      if (map.getLayer(WINDOW_LAYER)) map.removeLayer(WINDOW_LAYER)
      worker.dispose()
      layer.current = null
      builder.current = null
    }
  }, [mapRef, ready])
  return { layer, builder }
}

export function useNightCity({
  mapRef,
  ready,
  regions,
  excluded,
  colors,
  volumeColor,
  sun,
}: NightCityInput) {
  const [viewport, setViewport] = useState<SceneViewport>()
  const { layer, builder } = useWindowLayer(mapRef, ready)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    return watchSceneViewport(map, setViewport)
  }, [mapRef, ready])
  const regionIds = useMemo(() => regions.map((item) => item.id), [regions])
  const versions = useTileVersions(regionIds)
  const regionId = viewport ? regionFor(regions, viewport.center) : undefined
  const request = useMemo(
    () =>
      viewport && regionId
        ? { regionId, bbox: viewport.bbox, zoom: viewport.zoom, version: versions.get(regionId) }
        : undefined,
    [viewport, regionId, versions],
  )
  const scene = useMapScene(request)
  const hidden = useMemo(() => new Set(excluded), [excluded])
  useEffect(() => {
    const map = mapRef.current
    const data = scene.data
    if (!ready || !map || !data) return
    renderSceneVolumes(map, data as unknown as FeatureCollection, volumeColor, excluded)
    const [west, south, east, north] = data.bbox
    const origin = [((west ?? 0) + (east ?? 0)) / 2, ((south ?? 0) + (north ?? 0)) / 2] as const
    void builder.current
      ?.build(windowBuildings(map, data, hidden), origin)
      .then((mesh) => layer.current?.setMesh(mesh))
  }, [mapRef, ready, scene.data, volumeColor, excluded, hidden, builder, layer])
  const night = nightFactor(sun.altitude)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    renderNightLights(map, night, { lamp: colors.lamp, cityGlow: colors.cityGlow })
    const update = () =>
      layer.current?.setLight({
        night,
        fade: windowFade(map.getZoom()),
        warm: rgb(colors.windowWarm),
        cool: rgb(colors.windowCool),
      })
    update()
    map.on("zoom", update)
    return () => {
      map.off("zoom", update)
    }
  }, [mapRef, ready, night, colors, layer])
}
