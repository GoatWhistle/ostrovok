import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import type { AppearancePackage } from "@/shared/geo/appearance/types"
import { labelAnchor } from "@/shared/geo/basemap/basemap-labels"
import { markSceneBuildings } from "@/shared/geo/buildings/overview-buildings"
import { type QualityLevel, windowDensity } from "@/shared/geo/engine/map-quality"
import { type SceneViewport, watchSceneViewport } from "@/shared/geo/engine/scene-viewport"
import {
  nightFactor,
  renderNightLights,
  renderSceneVolumes,
  windowFade,
} from "@/shared/geo/night-city/night-layers"
import { WindowBuilder } from "@/shared/geo/night-city/window-builder"
import { WINDOW_LAYER, WindowLayer } from "@/shared/geo/night-city/window-layer"
import { withRoofForms } from "@/shared/geo/roof-forms/layer"
import type { SunPosition } from "@/shared/geo/terrain/terrain"
import type { MapColors } from "@/shared/theme"
import { useMapScene } from "../map-scene.queries"
import { useTileVersions } from "../map-style.queries"
import {
  type DrawnVolume,
  type RegionBox,
  regionFor,
  rgb,
  sceneCollection,
} from "./night-city-data"
import { useRoofMesh } from "./use-roof-mesh"
import { useTreeMesh } from "./use-tree-mesh"
import { useWindowMesh } from "./use-window-mesh"

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
  const roofless = useMemo(() => [...textured], [textured])
  const windowless = useMemo(
    () => (effects.facades ? new Set<string>() : textured),
    [effects.facades, textured],
  )
  useRoofMesh(mapRef, ready, scene.data, roofless, drawn, effects.roofs)
  useTreeMesh(mapRef, ready, effects.trees)
  useEffect(() => {
    const map = mapRef.current
    const data = scene.data
    if (!ready || !map || !data) return
    renderSceneVolumes(
      map,
      sceneCollection({ ...data, features: withRoofForms(data.features) }),
      volumeColor,
      excluded,
    )
    markSceneBuildings(
      map,
      data.features.map((feature) => feature.properties.building_id),
    )
    if (map.getLayer(WINDOW_LAYER)) map.moveLayer(WINDOW_LAYER, labelAnchor(map))
  }, [mapRef, ready, scene.data, volumeColor, excluded])
  useWindowMesh({
    mapRef,
    ready,
    enabled: effects.windows,
    scene: scene.data,
    drawn,
    textured: windowless,
    layer,
    builder,
  })
  const night = nightFactor(sun.altitude)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const lights = quality >= 2 || !effects.lights ? 0 : night
    renderNightLights(map, lights, { lamp: colors.lamp, cityGlow: colors.cityGlow })
    const update = () =>
      layer.current?.setLight({
        night,
        fade: windowFade(map.getZoom(), night),
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
