import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import styles from "./scene-sun.module.css"
import { type SunPreview, usePreviewedSun } from "./sun-preview"

const DEGREE = Math.PI / 180
const SIDE_LIMIT = 80
const EDGE = 64

export interface SceneSunProps {
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly azimuth: number
  readonly altitude: number
  readonly preview?: SunPreview
}

function place(map: MapLibreMap, azimuth: number, altitude: number) {
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const focal = height / 2 / Math.tan((map.getVerticalFieldOfView() * DEGREE) / 2)
  const padding = map.getPadding()
  const centerX = width / 2 + ((padding.left ?? 0) - (padding.right ?? 0)) / 2
  const centerY = height / 2 + ((padding.top ?? 0) - (padding.bottom ?? 0)) / 2
  const side = ((((azimuth - map.getBearing()) % 360) + 540) % 360) - 180
  const rise = 90 - map.getPitch() + altitude
  const x = centerX + focal * Math.tan(side * DEGREE)
  const y = centerY - focal * Math.tan(Math.min(rise, 89) * DEGREE)
  const visible =
    Math.abs(side) < SIDE_LIMIT &&
    altitude > -2 &&
    rise < 85 &&
    x > -EDGE &&
    x < width + EDGE &&
    y > -EDGE &&
    y < height
  return { x, y, visible }
}

export function SceneSun({ map, ready, azimuth: base, altitude: high, preview }: SceneSunProps) {
  const sun = useRef<HTMLSpanElement>(null)
  const live = usePreviewedSun(preview)
  const azimuth = live?.position.azimuth ?? base
  const altitude = live?.position.altitude ?? high
  useEffect(() => {
    const instance = map.current
    const element = sun.current
    if (!ready || !instance || !element) return
    const update = () => {
      const { x, y, visible } = place(instance, azimuth, altitude)
      element.style.setProperty("--sun-x", `${x}px`)
      element.style.setProperty("--sun-y", `${y}px`)
      element.dataset.visible = String(visible)
    }
    update()
    instance.on("move", update)
    instance.on("resize", update)
    return () => {
      instance.off("move", update)
      instance.off("resize", update)
    }
  }, [map, ready, azimuth, altitude])
  return <span ref={sun} className={styles.sun} data-visible="false" aria-hidden="true" />
}
