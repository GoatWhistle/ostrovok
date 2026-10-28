import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef, useState } from "react"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"
import { motionCurve, motionMs } from "@/shared/motion"
import { flyToSearchArea, flyToSearchScene } from "./search-camera"

export function useSearchCamera(
  map: RefObject<MapLibreMap | null>,
  active: boolean,
  journey: SearchJourney | undefined,
  selected: boolean,
  reduced: boolean,
  scene: SearchPreview | undefined,
) {
  useEffect(() => {
    if (journey?.request !== undefined) map.current?.stop()
  }, [map, journey?.request])
  const applied = useRef("")
  const gestures = useRef(new Set<string>())
  const [interacting, setInteracting] = useState(false)
  const inspecting = selected && !journey?.sending && !journey?.winner
  const blocked = !active || interacting || inspecting
  useEffect(() => {
    const instance = map.current
    if (!instance || !active) return
    const subscriptions = (["drag", "zoom", "rotate", "pitch"] as const).map((kind) => {
      const start = (event: { originalEvent?: unknown }) => {
        if (event.originalEvent) {
          gestures.current.add(kind)
          setInteracting(true)
        }
      }
      const end = () => {
        if (gestures.current.delete(kind) && gestures.current.size === 0) setInteracting(false)
      }
      instance.on(`${kind}start`, start)
      instance.on(`${kind}end`, end)
      return () => {
        instance.off(`${kind}start`, start)
        instance.off(`${kind}end`, end)
      }
    })
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe()
      gestures.current.clear()
    }
  }, [map, active])
  useEffect(() => {
    const instance = map.current
    if (!instance || blocked || !journey) return
    const key = `${journey.request}:${scene?.id ?? "area"}:${scene?.place_id ?? ""}`
    if (key === applied.current) return
    const duration = reduced ? 0 : motionMs("--story-search-flight")
    const easing = motionCurve("--ease-in-out")
    if (validScene(scene)) {
      applied.current = key
      flyToSearchScene(instance, scene, duration, easing)
      return
    }
    if (flyToSearchArea(instance, journey, duration, easing)) applied.current = key
  }, [map, blocked, journey, reduced, scene])
}

function validScene(scene: SearchPreview | undefined): scene is SearchPreview {
  return Boolean(scene && scene.location.length === 2 && scene.location.every(Number.isFinite))
}
