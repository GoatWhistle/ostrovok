import { clsx } from "clsx"
import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { startSeaRipples } from "../../../geo/sea-ripples"
import { motionMs, useReducedMotion } from "../../../motion"
import styles from "./sea-ripples.module.css"

const RIPPLES = 80
const LIFE_STEPS = 2

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
    if (!ready || !instance || !element || reduced) return
    return startSeaRipples(instance, element, {
      lifeMs: motionMs("--dur-breathe") * LIFE_STEPS,
      count: RIPPLES,
    })
  }, [map, ready, reduced])
  return <canvas ref={canvas} className={clsx(styles.ripples, className)} />
}
