import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { overlayInsets, setOverlayInsets } from "./map-insets"

export function useMapInsets(
  mapRef: RefObject<MapLibreMap | null>,
  active: boolean,
  occupied: boolean,
) {
  const stage = useRef<HTMLElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = mapRef.current
    const element = stage.current
    if (!element) return
    const update = () => {
      const frame = element.getBoundingClientRect()
      const box = occupied ? card.current?.getBoundingClientRect() : undefined
      const { right, bottom } = overlayInsets(
        frame,
        box,
        matchMedia("(max-width: 63.99rem)").matches,
      )
      element.style.setProperty("--map-overlay-right", `${right}px`)
      element.style.setProperty("--map-overlay-bottom", `${bottom}px`)
      if (map && active) setOverlayInsets(map, right, bottom)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (card.current) observer.observe(card.current)
    return () => observer.disconnect()
  }, [mapRef, active, occupied])
  return { stage, card }
}
