import { useEffect, useMemo, useState } from "react"
import { useHotelScene } from "@/entities/hotel"
import { useBasemaps, useMapCatalog } from "@/entities/map-data"
import { useMapInstance } from "@/shared/geo/engine/use-map-instance"
import { useMapRendering } from "@/shared/geo/engine/use-map-rendering"
import { featureCollection } from "@/shared/geo/geometry"
import { renderBuildings, renderHighlights } from "@/shared/geo/map-layers"
import { retainPmtiles } from "@/shared/geo/pmtiles-protocol"
import { followTerrainZoom } from "@/shared/geo/terrain"
import { useLocale } from "@/shared/i18n"
import { useMapColors } from "@/shared/theme"
import walk from "./beach-walk.json"

const OPTIONS = {
  interactive: false,
  maxPitch: 80,
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  center: [39.907, 43.4482] as [number, number],
  zoom: 14.5,
  pitch: 16,
  bearing: -54,
}
const SUN = { azimuth: 250, altitude: -8 }
const REGIONS = ["sochi"]

export function useCoverMap(enabled: boolean, visible: boolean) {
  const map = useMapInstance(enabled, OPTIONS)
  const scene = useHotelScene(enabled ? "n11331531334" : undefined)
  const catalog = useMapCatalog()
  const assets = useBasemaps(enabled ? REGIONS : [])
  const { locale } = useLocale()
  const colors = useMapColors()
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
      sun: SUN,
      excluded: buildings.features.map((item) => String(item.id)),
    }),
    [catalog.data, assets, locale, buildings],
  )
  const rendering = useMapRendering(map.instance, map.ready, snapshot, map.active && visible)
  useEffect(() => retainPmtiles(), [])
  useEffect(() => {
    const current = map.instance.current
    if (!map.ready || !current || !scene.data || !catalog.data || !assets.length) return
    renderBuildings(current, buildings, colors)
    renderHighlights(
      current,
      featureCollection([{ ...walk, properties: { kind: "route", mode: "walk" } }]),
      colors,
    )
    const idle = () => setLoaded(true)
    current.once("idle", idle)
    const unwatch = followTerrainZoom(current)
    return () => {
      current.off("idle", idle)
      unwatch()
    }
  }, [map.instance, map.ready, scene.data, catalog.data, assets, buildings, colors])
  return {
    ...map,
    loaded,
    colors,
    failed: map.failed || rendering.failed || scene.isError || catalog.isError,
  }
}
