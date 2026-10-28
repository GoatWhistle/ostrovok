import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useHotelScene } from "@/entities/hotel"
import { drawnVolumes, useBasemaps, useMapCatalog, useNightCity } from "@/entities/map-data"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import { appearanceClasses } from "@/shared/geo/appearance/palette"
import { useMapInstance } from "@/shared/geo/engine/use-map-instance"
import { useMapRendering } from "@/shared/geo/engine/use-map-rendering"
import { featureCollection } from "@/shared/geo/geometry"
import { renderBuildings, renderHighlights } from "@/shared/geo/map-layers"
import { retainPmtiles } from "@/shared/geo/pmtiles-protocol"
import { followTerrainZoom, type SunPosition } from "@/shared/geo/terrain"
import { useLocale } from "@/shared/i18n"
import { motionMs } from "@/shared/motion"
import { type MapColors, useMapAppearance, useMapColors, useTheme } from "@/shared/theme"
import type { ReelCamera } from "../shots"
import walk from "./beach-walk.json"

const OPTIONS = {
  interactive: false,
  maxPitch: 80,
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  center: [39.9035, 43.4455] as [number, number],
  zoom: 16.7,
  pitch: 50,
  bearing: -58,
}
const DAY_SUN = { azimuth: 250, altitude: 32 }
const DUSK_SUN = { azimuth: 250, altitude: -8 }
const SUNSET_SUN = { azimuth: 250, altitude: 1.5 }
const REGIONS = ["sochi"]
const NO_TEXTURES: ReadonlySet<string> = new Set()
const QUALITY = 1

function settle(map: MapLibreMap, camera: ReelCamera, limit: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer)
      map.off("idle", done)
      resolve()
    }
    const timer = window.setTimeout(done, limit)
    map.once("idle", done)
    map.jumpTo({ ...camera, center: [camera.center[0], camera.center[1]] })
  })
}

async function preload(map: MapLibreMap, cameras: readonly ReelCamera[], cancelled: () => boolean) {
  const limit = motionMs("--story-shot")
  for (const camera of [...cameras.slice(1), ...cameras.slice(0, 1)]) {
    if (cancelled()) return
    await settle(map, camera, limit)
  }
}

function useCityLayers(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  buildings: readonly unknown[],
  sun: SunPosition,
  colors: MapColors,
) {
  const regions = useRegions()
  const catalog = useMapCatalog()
  const appearance = useMapAppearance()
  const boxes = useMemo(
    () =>
      regions.data?.items?.flatMap((item) =>
        item.id && item.bbox ? [{ id: item.id, bbox: item.bbox }] : [],
      ) ?? [],
    [regions.data],
  )
  const drawn = useMemo(() => drawnVolumes(buildings), [buildings])
  const classes = useMemo(
    () => appearanceClasses(appearance.id, catalog.data?.classes ?? [], colors, sun.altitude),
    [appearance.id, catalog.data, colors, sun.altitude],
  )
  useNightCity({
    mapRef,
    ready,
    regions: boxes,
    drawn,
    textured: NO_TEXTURES,
    colors,
    volumeColor: classes.volume,
    sun,
    quality: QUALITY,
    effects: APPEARANCES[appearance.id].effects,
  })
}

export function useCoverMap(
  enabled: boolean,
  visible: boolean,
  cameras: readonly ReelCamera[],
  golden: boolean,
) {
  const map = useMapInstance(enabled, OPTIONS)
  const scene = useHotelScene(enabled ? "n11331531334" : undefined)
  const catalog = useMapCatalog()
  const assets = useBasemaps(enabled ? REGIONS : [])
  const { locale } = useLocale()
  const colors = useMapColors()
  const { theme } = useTheme()
  const sun = golden ? SUNSET_SUN : theme === "dark" ? DUSK_SUN : DAY_SUN
  const [loaded, setLoaded] = useState(false)
  const buildings = useMemo(
    () =>
      featureCollection([
        ...(scene.data?.context_buildings?.features ?? []),
        ...(scene.data?.building?.features ?? []),
      ]),
    [scene.data],
  )
  const snapshot = useMemo(
    () => ({
      catalog: catalog.data?.classes ?? [],
      assets,
      locale,
      sun,
      excluded: buildings.features.map((item) => String(item.id)),
    }),
    [catalog.data, assets, locale, buildings, sun],
  )
  const rendering = useMapRendering(map.instance, map.ready, snapshot, map.active && visible)
  useCityLayers(map.instance, map.ready && visible, buildings.features, sun, colors)
  const prepared = scene.data !== undefined && catalog.data !== undefined && assets.length > 0
  useEffect(() => retainPmtiles(), [])
  useEffect(() => {
    const current = map.instance.current
    if (!map.ready || !current || !prepared) return
    renderBuildings(current, buildings, colors)
    renderHighlights(
      current,
      featureCollection([{ ...walk, properties: { kind: "route", mode: "walk" } }]),
      colors,
    )
    return followTerrainZoom(current)
  }, [map.instance, map.ready, prepared, buildings, colors])
  useEffect(() => {
    const current = map.instance.current
    if (!map.ready || !current || !prepared || loaded) return
    let cancelled = false
    void preload(current, cameras, () => cancelled).then(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [map.instance, map.ready, prepared, cameras, loaded])
  return {
    ...map,
    loaded,
    colors,
    failed: map.failed || rendering.failed || scene.isError || catalog.isError,
  }
}
