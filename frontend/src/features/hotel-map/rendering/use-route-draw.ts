import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { type HighlightColors, paintRoute } from "@/shared/geo/map-layers"
import { motionMs, readEasing } from "@/shared/motion"

export function useRouteDraw(
  mapRef: RefObject<MapLibreMap | null>,
  route: string | undefined,
  colors: HighlightColors,
  reduced: boolean,
) {
  const palette = useRef(colors)
  const progress = useRef(1)
  useEffect(() => {
    palette.current = colors
    const map = mapRef.current
    if (map) paintRoute(map, colors, progress.current)
  }, [mapRef, colors])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !route) return
    progress.current = reduced ? 1 : 0
    paintRoute(map, palette.current, progress.current)
    if (reduced) return
    const effect = new KeyframeEffect(null, null, {
      duration: motionMs("--dur-draw"),
      easing: readEasing("--ease-in-out"),
      fill: "forwards",
    })
    const animation = new Animation(effect, document.timeline)
    let frame = 0
    const step = () => {
      progress.current = effect.getComputedTiming().progress ?? 1
      paintRoute(map, palette.current, progress.current)
      if (animation.playState !== "finished") frame = requestAnimationFrame(step)
    }
    animation.play()
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      animation.cancel()
      progress.current = 1
    }
  }, [mapRef, route, reduced])
}
