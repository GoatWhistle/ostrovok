import { clsx } from "clsx"
import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { startSeaRipples } from "../../../geo/sea-ripples"
import { useReducedMotion } from "../../../motion"
import styles from "./sea-ripples.module.css"

export interface SeaRipplesProps {
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly className?: string | undefined
}

export function SeaRipples({ map, ready, className }: SeaRipplesProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const instance = map.current
    const element = canvas.current
    if (!ready || !instance || !element) return
    return startSeaRipples(instance, element, { animate: !reduced })
  }, [map, ready, reduced])
  return <canvas ref={canvas} className={clsx(styles.ripples, className)} />
}
