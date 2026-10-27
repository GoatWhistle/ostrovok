import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef, useState } from "react"
import { MapAppearanceController, type MapSceneSnapshot } from "@/shared/geo/appearance/controller"
import { registerMapAppearance } from "@/shared/theme"

export function useMapRendering(
  instance: RefObject<MapLibreMap | null>,
  ready: boolean,
  scene: MapSceneSnapshot,
  active: boolean,
) {
  const renderer = useRef<MapAppearanceController | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const map = instance.current
    if (!map || !ready) return
    const controller = new MapAppearanceController(map)
    const unregister = registerMapAppearance(controller)
    renderer.current = controller
    return () => {
      unregister()
      controller.dispose()
      renderer.current = null
    }
  }, [instance, ready])
  useEffect(() => {
    if (ready) renderer.current?.setVisible(active)
  }, [active, ready])
  useEffect(() => {
    if (!ready || !renderer.current) return
    try {
      renderer.current.updateScene(scene)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [ready, scene])
  return { renderer, failed }
}
