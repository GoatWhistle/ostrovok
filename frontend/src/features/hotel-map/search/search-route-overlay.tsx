import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react"
import type { SearchPreview } from "@/shared/api/search-preview"
import { motionMs, readEasing, useReducedMotion } from "@/shared/motion"
import styles from "./search-route-overlay.module.css"

export function SearchRouteOverlay({
  map,
  scene,
  active,
}: {
  readonly map: RefObject<MapLibreMap | null>
  readonly scene: SearchPreview | undefined
  readonly active: boolean
}) {
  const path = useRef<SVGPathElement>(null)
  const start = useRef<SVGCircleElement>(null)
  const end = useRef<SVGCircleElement>(null)
  const label = useRef<SVGTextElement>(null)
  const reduced = useReducedMotion()
  const onsite = scene?.mode === "onsite"
  const routeKey = JSON.stringify(scene?.route)
  const coordinateKey = JSON.stringify(
    scene?.route?.coordinates ??
      (scene
        ? [scene.location, ...(scene.place_location && !onsite ? [scene.place_location] : [])]
        : []),
  )
  useLayoutEffect(() => {
    const instance = map.current
    const line = path.current
    if (!instance || !active || !line) return
    const coordinates: number[][] = JSON.parse(coordinateKey)
    const paint = () => {
      const points = coordinates.map((at) => instance.project([at[0] ?? 0, at[1] ?? 0]))
      line.setAttribute(
        "d",
        (onsite ? [] : points).map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" "),
      )
      for (const [node, point] of [
        [start.current, points[0]],
        [end.current, points.at(-1)],
      ] as const) {
        if (!node || !point) continue
        node.setAttribute("cx", String(point.x))
        node.setAttribute("cy", String(point.y))
      }
      if (points[0]) {
        label.current?.setAttribute("x", String(points[0].x))
        label.current?.setAttribute("y", String(points[0].y))
      }
    }
    paint()
    instance.on("move", paint)
    instance.on("resize", paint)
    return () => {
      instance.off("move", paint)
      instance.off("resize", paint)
    }
  }, [map, coordinateKey, active, onsite])
  useEffect(() => {
    const line = path.current
    if (!line || !active || reduced || onsite || !routeKey) return
    const animation = line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: motionMs("--dur-draw"),
      delay: motionMs("--story-search-flight"),
      easing: readEasing("--ease-in-out"),
      fill: "both",
    })
    return () => animation.cancel()
  }, [routeKey, onsite, reduced, active])
  if (!scene || !active) return null
  return (
    <svg className={styles.overlay} width="100%" height="100%" aria-hidden="true">
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        ref={path}
        pathLength={1}
        className={styles.route}
        data-straight={scene.mode === "straight"}
      />
      <circle ref={start} r={7} className={styles.point} />
      {scene.mode !== "onsite" && (scene.route || scene.place_location) ? (
        <circle ref={end} r={6} className={styles.point} />
      ) : null}
      <text ref={label} dy="-1em" textAnchor="middle" className={styles.label}>
        {scene.name}
      </text>
    </svg>
  )
}
