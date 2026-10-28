import type { Map as MapLibreMap } from "maplibre-gl"
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from "react"
import type { MapAppearance } from "@/shared/geo/appearance/types"
import { useTranslation } from "@/shared/i18n"
import { motionMs, prefersReducedMotion } from "@/shared/motion"
import { Button } from "@/shared/ui"
import { MapAppearanceControl } from "./appearance/map-appearance-control"
import styles from "./map-controls.module.css"

export interface MapControlsProps {
  readonly fullMap?: boolean
  readonly onExpand?: (() => void) | undefined
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly disabled: boolean
  readonly onAppearance: (id: MapAppearance) => void
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

function useFlat(map: RefObject<MapLibreMap | null>, ready: boolean) {
  const [flat, setFlat] = useState(false)
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const update = () => setFlat(instance.getPitch() < 10)
    update()
    instance.on("pitchend", update)
    return () => {
      instance.off("pitchend", update)
    }
  }, [map, ready])
  return flat
}

export function MapControls({
  map,
  ready,
  disabled,
  onOverview,
  onAppearance,
  onExpand,
  fullMap,
}: MapControlsProps) {
  const { t } = useTranslation()
  const compass = useBearing(map, ready)
  const flat = useFlat(map, ready)
  return (
    <div className={styles.controls} data-full-map={fullMap} data-map-obstacle>
      <div className={styles.group}>
        {onExpand && !fullMap ? (
          <Button
            variant="ghost"
            iconOnly
            icon="expand"
            data-map-expand
            className={styles.control}
            title={t("explore:map.fullscreen")}
            onClick={onExpand}
          >
            {t("explore:map.fullscreen")}
          </Button>
        ) : null}
        <MapAppearanceControl onChange={onAppearance} />
      </div>
      <div className={styles.group} data-group="zoom">
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
        <Button
          variant="ghost"
          className={styles.mode}
          title={flat ? t("explore:map.tilt") : t("explore:map.flat")}
          aria-label={flat ? t("explore:map.tilt") : t("explore:map.flat")}
          disabled={disabled}
          onClick={(event) =>
            map.current?.easeTo({ pitch: flat ? 60 : 0, duration: duration(event) })
          }
        >
          {flat ? t("explore:map.view3d") : t("explore:map.view2d")}
        </Button>
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
    </div>
  )
}
