import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect } from "react"
import { tileWindowBuildings } from "@/shared/geo/night-city/tile-windows"
import type { WindowBuilder } from "@/shared/geo/night-city/window-builder"
import type { WindowLayer } from "@/shared/geo/night-city/window-layer"
import { watchRoofTriggers } from "@/shared/geo/roof-mesh/triggers"
import type { MapRenderScene } from "../map-scene.queries"
import { type DrawnVolume, windowBuildings } from "./night-city-data"

export interface WindowMeshInput {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly enabled: boolean
  readonly scene: MapRenderScene | undefined
  readonly drawn: ReadonlyMap<string, DrawnVolume>
  readonly textured: ReadonlySet<string>
  readonly layer: RefObject<WindowLayer | null>
  readonly builder: RefObject<WindowBuilder | null>
}

export function useWindowMesh({
  mapRef,
  ready,
  enabled,
  scene,
  drawn,
  textured,
  layer,
  builder,
}: WindowMeshInput) {
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    let disposed = false
    const currentBuilder = builder.current
    const currentLayer = layer.current
    const build = () => {
      const center = map.getCenter()
      const origin = [center.lng, center.lat] as const
      const own = scene ? windowBuildings(map, scene, drawn, textured) : []
      const skip = new Set(textured)
      for (const feature of scene?.features ?? []) skip.add(feature.properties.building_id)
      const buildings = [...own, ...tileWindowBuildings(map, skip, origin)]
      void currentBuilder?.build(buildings, origin).then((mesh) => {
        if (!disposed && mesh && layer.current === currentLayer) currentLayer?.setMesh(mesh)
      })
    }
    const unwatch = watchRoofTriggers(map, build)
    return () => {
      disposed = true
      currentBuilder?.cancel()
      unwatch()
    }
  }, [mapRef, ready, enabled, scene, drawn, textured, layer, builder])
}
