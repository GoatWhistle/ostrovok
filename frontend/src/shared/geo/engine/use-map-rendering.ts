import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef, useState } from "react"
import { MapAppearanceController, type MapSceneSnapshot } from "@/shared/geo/appearance/controller"
import { registerMapAppearance } from "@/shared/theme"
import type { MapAppearance } from "../appearance/types"

export function useMapRendering(
  instance: RefObject<MapLibreMap | null>,
  ready: boolean,
  scene: MapSceneSnapshot,
  active: boolean,
  profile: "main" | "mini" = "main",
  override?: MapAppearance,
) {
  const renderer = useRef<MapAppearanceController | null>(null)
  const [failed, setFailed] = useState(false)
  const forced = useRef(override)
  forced.current = override
  useEffect(() => {
    const map = instance.current
    if (!map || !ready) return
    const controller = new MapAppearanceController(map, profile)
    const unregister = registerMapAppearance({
      applyAppearance: (id) => controller.applyAppearance(forced.current ?? id),
    })
    renderer.current = controller
    return () => {
      unregister()
      controller.dispose()
      renderer.current = null
    }
  }, [instance, ready, profile])
  useEffect(() => {
    if (!ready || !renderer.current) return
    const controller = renderer.current
    const unregister = registerMapAppearance({
      applyAppearance: (id) => controller.applyAppearance(override ?? id),
    })
    return unregister
  }, [ready, override])
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
