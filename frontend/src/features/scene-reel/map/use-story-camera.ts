import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useLayoutEffect, useRef } from "react"
import { paintRoute } from "@/shared/geo/map-layers"
import type { MapColors } from "@/shared/theme"
import type { StoryFrame } from "../playback/story-frame"

export function useStoryCamera(
  map: RefObject<MapLibreMap | null>,
  ready: boolean,
  frame: StoryFrame,
  colors: MapColors,
) {
  const hotel = useRef<HTMLDivElement>(null)
  const goal = useRef<HTMLDivElement>(null)
  const previous = useRef("")
  useLayoutEffect(() => {
    const current = map.current
    if (!ready || !current || frame.world >= 1) return
    const camera = JSON.stringify(frame.camera)
    if (camera !== previous.current) {
      current.jumpTo(frame.camera)
      previous.current = camera
    }
    paintRoute(current, colors, frame.route)
    for (const [id, opacity] of [
      ["route-line", 1],
      ["route-casing", 0.35],
      ["route-glow", 0.55],
    ] as const)
      if (current.getLayer(id))
        current.setPaintProperty(id, "line-opacity", opacity * frame.routeOpacity)
    const positions = [
      [hotel.current, [39.904065, 43.4451502]],
      [goal.current, [39.902377, 43.446413]],
    ] as const
    for (const [element, coordinates] of positions) {
      if (!element) continue
      const point = current.project([...coordinates])
      element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`
    }
  }, [map, ready, frame, colors])
  return { hotel, goal }
}
