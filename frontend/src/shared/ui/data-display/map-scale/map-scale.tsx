import type { Map as MapLibreMap } from "maplibre-gl"
import { type CSSProperties, type RefObject, useEffect, useState } from "react"
import { useLocale } from "@/shared/i18n"
import styles from "./map-scale.module.css"

const EQUATOR_METERS = 40075016.686
const TILE_PIXELS = 512
const MAX_PIXELS = 72
const STEPS = [1, 2, 5] as const

interface Scale {
  readonly meters: number
  readonly pixels: number
}

function measure(map: MapLibreMap): Scale | null {
  const latitude = (map.getCenter().lat * Math.PI) / 180
  const perPixel = (EQUATOR_METERS * Math.cos(latitude)) / (TILE_PIXELS * 2 ** map.getZoom())
  if (!Number.isFinite(perPixel) || perPixel <= 0) return null
  const limit = perPixel * MAX_PIXELS
  const power = 10 ** Math.floor(Math.log10(limit))
  const meters =
    [...STEPS]
      .reverse()
      .map((step) => step * power)
      .find((value) => value <= limit) ?? power
  return { meters, pixels: Math.round(meters / perPixel) }
}

function scaleLabel(meters: number, locale: string) {
  const kilometers = meters >= 1000
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "unit",
    unit: kilometers ? "kilometer" : "meter",
    unitDisplay: "short",
  }).format(kilometers ? meters / 1000 : meters)
}

export function MapScale({
  map,
  ready,
}: {
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
}) {
  const { locale } = useLocale()
  const [scale, setScale] = useState<Scale | null>(null)
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const update = () =>
      setScale((current) => {
        const next = measure(instance)
        return current && next && current.meters === next.meters && current.pixels === next.pixels
          ? current
          : next
      })
    update()
    instance.on("move", update)
    return () => {
      instance.off("move", update)
    }
  }, [map, ready])
  if (!scale) return null
  return (
    <span
      className={styles.scale}
      style={
        {
          "--scale-width": `${scale.pixels}px`,
          "--scale-track": `${MAX_PIXELS}px`,
        } as CSSProperties
      }
    >
      <span className={styles.scaleTrack} aria-hidden="true">
        <span className={styles.scaleBar} />
      </span>
      <span className={styles.scaleLabel}>{scaleLabel(scale.meters, locale)}</span>
    </span>
  )
}
