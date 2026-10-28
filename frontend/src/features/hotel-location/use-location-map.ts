import { Marker } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef } from "react"
import { useRegions } from "@/entities/catalog"
import { useBasemaps, useMapCatalog } from "@/entities/map-data"
import { applyMiniProfile } from "@/shared/geo/appearance/mini-profile"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import { retainPmtiles } from "@/shared/geo/basemap/pmtiles-protocol"
import { paintRoute, renderHighlights } from "@/shared/geo/buildings/map-layers"
import { useMapInstance } from "@/shared/geo/engine/use-map-instance"
import { useMapRendering } from "@/shared/geo/engine/use-map-rendering"
import { featureCollection } from "@/shared/geo/geometry/geometry"
import { geometryBounds } from "@/shared/geo/geometry/geometry-bounds"
import { useLocale } from "@/shared/i18n"
import { useMapAppearance, useMapColors } from "@/shared/theme"

const OPTIONS = { interactive: false, pitch: 0, bearing: 0, maxZoom: 17, pixelRatio: 1 } as const
const SUN = { azimuth: 180, altitude: 40 }

export function useLocationMap(
  point: [number, number],
  features: readonly unknown[],
  marker: RefObject<HTMLSpanElement | null>,
) {
  const map = useMapInstance(true, OPTIONS)
  const regions = useRegions()
  const ids = useMemo(
    () => regions.data?.items?.flatMap((item) => (item.id ? [item.id] : [])) ?? [],
    [regions.data],
  )
  const assets = useBasemaps(ids)
  const catalog = useMapCatalog()
  const { locale } = useLocale()
  const appearance = useMapAppearance()
  const colors = useMapColors()
  const scene = useMemo(
    () => ({ catalog: catalog.data?.classes ?? [], assets, locale, sun: SUN, excluded: [] }),
    [catalog.data, assets, locale],
  )
  const rendering = useMapRendering(map.instance, map.ready, scene, map.active, "mini")
  useEffect(() => retainPmtiles(), [])
  const data = useMemo(() => featureCollection(features), [features])
  const command = JSON.stringify([point, data.features.map((item) => item.geometry)])
  const applied = useRef<string | undefined>(undefined)
  useEffect(() => {
    const instance = map.instance.current
    if (!instance || !map.active || applied.current === command) return
    applied.current = command
    const bounds = geometryBounds(data, point)
    if (data.features.length && bounds)
      instance.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 16, bearing: 0 })
    else instance.jumpTo({ center: point, zoom: 15, pitch: 0, bearing: 0 })
  }, [map.instance, map.active, command, point, data])
  useEffect(() => {
    const instance = map.instance.current
    if (!instance || !map.active) return
    renderHighlights(instance, data, colors)
    paintRoute(instance, colors, 1)
    applyMiniProfile(instance, APPEARANCES[appearance.id])
  }, [map.instance, map.active, data, colors, appearance.id])
  const lon = point[0]
  const lat = point[1]
  useEffect(() => {
    const instance = map.instance.current
    const element = marker.current
    if (!instance || !map.ready || !element) return
    const pin = new Marker({ element, anchor: "center" }).setLngLat([lon, lat]).addTo(instance)
    return () => {
      pin.remove()
    }
  }, [map.instance, map.ready, marker, lon, lat])
  return { ...map, failed: map.failed || rendering.failed }
}
