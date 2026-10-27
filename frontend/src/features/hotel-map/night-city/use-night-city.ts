import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useMapScene, useTileVersions } from "@/entities/map-data"
import type { AppearancePackage } from "@/shared/geo/appearance/types"
import { labelAnchor } from "@/shared/geo/basemap-labels"
import { type QualityLevel, windowDensity } from "@/shared/geo/map-quality"
import {
  nightFactor,
  renderNightLights,
  renderSceneVolumes,
  windowFade,
} from "@/shared/geo/night-city/night-layers"
import { watchTerrainData } from "@/shared/geo/night-city/terrain-watch"
import { WindowBuilder } from "@/shared/geo/night-city/window-builder"
import { WINDOW_LAYER, WindowLayer } from "@/shared/geo/night-city/window-layer"
import { markSceneBuildings } from "@/shared/geo/overview-buildings"
import { renderRoofForms, withRoofForms } from "@/shared/geo/roof-forms/layer"
import { type SceneViewport, watchSceneViewport } from "@/shared/geo/scene-viewport"
import type { SunPosition } from "@/shared/geo/terrain"
import type { MapColors } from "@/shared/theme"
import {
  type DrawnVolume,
  type RegionBox,
  regionFor,
  rgb,
  sceneCollection,
  windowBuildings,
} from "./night-city-data"

export interface NightCityInput {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly regions: readonly RegionBox[]
  readonly drawn: ReadonlyMap<string, DrawnVolume>
  readonly textured: ReadonlySet<string>
  readonly colors: MapColors
  readonly volumeColor: ExpressionSpecification | string
  readonly sun: SunPosition
  readonly quality: QualityLevel
  readonly effects: AppearancePackage["effects"]
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
  drawn,
  textured,
  colors,
  volumeColor,
  sun,
  quality,
  effects,
}: NightCityInput) {
  const [viewport, setViewport] = useState<SceneViewport>()
  const { layer, builder } = useWindowLayer(mapRef, ready)
  const built = useRef<{ data: unknown; grounds: string } | undefined>(undefined)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    return watchSceneViewport(map, setViewport)
  }, [mapRef, ready])
  const regionIds = useMemo(() => regions.map((item) => item.id), [regions])
  const versions = useTileVersions(regionIds)
  const regionId = ready && viewport ? regionFor(regions, viewport.center) : undefined
  const request = useMemo(
    () =>
      viewport && regionId
        ? { regionId, bbox: viewport.bbox, zoom: viewport.zoom, version: versions.get(regionId) }
        : undefined,
    [viewport, regionId, versions],
  )
  const scene = useMapScene(request)
  const excluded = useMemo(() => [...drawn.keys()], [drawn])
  useEffect(() => {
    const map = mapRef.current
    const data = scene.data
    if (!ready || !map || !data) return
    const { buildings, roofs } = withRoofForms(data.features)
    renderSceneVolumes(
      map,
      sceneCollection({ ...data, features: buildings }),
      volumeColor,
      excluded,
    )
    renderRoofForms(map, roofs, excluded)
    markSceneBuildings(
      map,
      data.features.map((feature) => feature.properties.building_id),
    )
    if (map.getLayer(WINDOW_LAYER)) map.moveLayer(WINDOW_LAYER, labelAnchor(map))
  }, [mapRef, ready, scene.data, volumeColor, excluded])
  useEffect(() => {
    const map = mapRef.current
    const data = scene.data
    if (!ready || !map || !data) return
    const [west, south, east, north] = data.bbox
    const origin = [((west ?? 0) + (east ?? 0)) / 2, ((south ?? 0) + (north ?? 0)) / 2] as const
    if (!effects.windows) return
    let disposed = false
    const currentBuilder = builder.current
    const currentLayer = layer.current
    const build = () => {
      const buildings = windowBuildings(map, data, drawn, textured)
      const next = buildings.map((item) => Math.round(item.ground)).join(",")
      if (built.current?.data === data && built.current.grounds === next) return
      built.current = { data, grounds: next }
      void currentBuilder?.build(buildings, origin).then((mesh) => {
        if (!disposed && mesh && layer.current === currentLayer) currentLayer?.setMesh(mesh)
        else if (built.current?.data === data) built.current = undefined
      })
    }
    build()
    const unwatch = watchTerrainData(map, build)
    return () => {
      disposed = true
      currentBuilder?.cancel()
      unwatch()
    }
  }, [mapRef, ready, scene.data, drawn, textured, builder, layer, effects.windows])
  const night = nightFactor(sun.altitude)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const lights = quality >= 2 || !effects.lights ? 0 : night
    renderNightLights(map, lights, { lamp: colors.lamp, cityGlow: colors.cityGlow })
    const update = () =>
      layer.current?.setLight({
        night,
        fade: windowFade(map.getZoom()),
        density: effects.windows ? windowDensity(quality) : 0,
        glass: effects.facades ? 1 : 0,
        warm: rgb(colors.windowWarm),
        cool: rgb(colors.windowCool),
      })
    update()
    map.on("zoom", update)
    return () => {
      map.off("zoom", update)
    }
  }, [
    mapRef,
    ready,
    night,
    colors,
    layer,
    quality,
    effects.lights,
    effects.windows,
    effects.facades,
  ])
}
