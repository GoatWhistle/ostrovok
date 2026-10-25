import type { Map as MapLibreMap } from "maplibre-gl"
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { motionMs, prefersReducedMotion, usePresence } from "@/shared/motion"
import { Button, Icon } from "@/shared/ui"
import styles from "./map-controls.module.css"

export interface MapControlsProps {
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly disabled: boolean
  readonly onOverview: (instant: boolean) => void
}

function duration(event: MouseEvent<HTMLButtonElement>): number {
  return event.detail === 0 || prefersReducedMotion() ? 0 : motionMs("--dur-panel")
}

function useBearing(map: RefObject<MapLibreMap | null>, ready: boolean) {
  const compass = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const rotate = () =>
      compass.current?.style.setProperty("--map-bearing", `${-instance.getBearing()}deg`)
    rotate()
    instance.on("rotate", rotate)
    return () => {
      instance.off("rotate", rotate)
    }
  }, [map, ready])
  return compass
}

export function MapControls({ map, ready, disabled, onOverview }: MapControlsProps) {
  const { t } = useTranslation()
  const [legend, setLegend] = useState(false)
  const compass = useBearing(map, ready)
  const layers = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!legend) return
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setLegend(false)
      layers.current?.focus()
    }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [legend])
  return (
    <div className={styles.controls}>
      <div className={styles.group}>
        <Button
          variant="ghost"
          iconOnly
          icon="zoom-in"
          className={styles.control}
          title={t("explore:map.zoomIn")}
          disabled={disabled}
          onClick={(event) => map.current?.zoomIn({ duration: duration(event) })}
        >
          {t("explore:map.zoomIn")}
        </Button>
        <Button
          variant="ghost"
          iconOnly
          icon="zoom-out"
          className={styles.control}
          title={t("explore:map.zoomOut")}
          disabled={disabled}
          onClick={(event) => map.current?.zoomOut({ duration: duration(event) })}
        >
          {t("explore:map.zoomOut")}
        </Button>
      </div>
      <div className={styles.group}>
        <Button
          ref={compass}
          variant="ghost"
          iconOnly
          icon="compass"
          className={styles.compass}
          title={t("explore:map.north")}
          disabled={disabled}
          onClick={(event) => map.current?.easeTo({ bearing: 0, duration: duration(event) })}
        >
          {t("explore:map.north")}
        </Button>
      </div>
      <div className={styles.group}>
        <Button
          variant="ghost"
          iconOnly
          icon="locate"
          className={styles.control}
          title={t("explore:map.overview")}
          disabled={disabled}
          onClick={(event) => onOverview(duration(event) === 0)}
        >
          {t("explore:map.overview")}
        </Button>
      </div>
      <div className={styles.legendAnchor}>
        <div className={styles.group}>
          <Button
            ref={layers}
            variant="ghost"
            iconOnly
            icon="layers"
            className={styles.control}
            title={t("explore:map.layers")}
            aria-expanded={legend}
            aria-pressed={legend}
            onClick={() => setLegend((current) => !current)}
          >
            {t("explore:map.layers")}
          </Button>
        </div>
        <MapLegend open={legend} />
      </div>
    </div>
  )
}

const ITEMS = [
  { key: "legendFact", swatch: "fact" },
  { key: "legendRoute", swatch: "route" },
  { key: "legendHotel", swatch: "hotel" },
  { key: "legendSelected", swatch: "selected" },
  { key: "legendRelief", swatch: "relief" },
] as const

function MapLegend({ open }: { readonly open: boolean }) {
  const { t } = useTranslation()
  const presence = usePresence(open)
  if (!presence.mounted) return null
  return (
    <section
      className={styles.legend}
      data-state={presence.state}
      aria-label={t("explore:map.layers")}
      onAnimationEnd={presence.onAnimationEnd}
    >
      <p className={styles.legendTitle}>{t("explore:map.layers")}</p>
      <ul className={styles.legendList}>
        {ITEMS.map((item) => (
          <li key={item.key} className={styles.legendItem}>
            <span className={styles.swatch} data-swatch={item.swatch} aria-hidden="true">
              {item.swatch === "hotel" || item.swatch === "selected" ? (
                <Icon name="check" size="sm" />
              ) : null}
            </span>
            <span>{t(`explore:map.${item.key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
