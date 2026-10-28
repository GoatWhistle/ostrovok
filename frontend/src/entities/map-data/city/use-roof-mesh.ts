import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { labelAnchor } from "@/shared/geo/basemap/basemap-labels"
import { hideMeshedContext } from "@/shared/geo/buildings/context-height"
import { MESH_FROM, markMeshBuildings } from "@/shared/geo/buildings/overview-buildings"
import { hideMeshedSceneVolumes } from "@/shared/geo/night-city/night-layers"
import { WINDOW_LAYER } from "@/shared/geo/night-city/window-layer"
import { ROOF_MESH_LAYER, RoofMeshLayer } from "@/shared/geo/roof-mesh/layer"
import { buildRoofMesh } from "@/shared/geo/roof-mesh/mesh"
import {
  isSolid,
  type RoofCandidate,
  roofInputs,
  tileCandidates,
} from "@/shared/geo/roof-mesh/sources"
import { watchRoofTriggers } from "@/shared/geo/roof-mesh/triggers"
import type { MapRenderScene } from "../map-scene.queries"
import type { DrawnVolume } from "./night-city-data"

function sceneCandidates(
  scene: MapRenderScene | undefined,
  skip: ReadonlySet<string>,
  drawn: ReadonlyMap<string, DrawnVolume>,
) {
  return (scene?.features ?? []).flatMap((feature): RoofCandidate[] => {
    const id = feature.properties.building_id
    if (skip.has(id) || feature.properties.hotel_id) return []
    const geometry = feature.geometry as RoofCandidate["geometry"]
    return [
      {
        id,
        geometry,
        height: drawn.get(id)?.height || feature.properties.render_height_m,
        levels: feature.properties.levels,
        solid: (drawn.get(id)?.base ?? 0) === 0 && isSolid(geometry),
      },
    ]
  })
}

function grow(map: MapLibreMap) {
  return map.getZoom() >= MESH_FROM ? 1 : 0
}

export function useRoofMesh(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  scene: MapRenderScene | undefined,
  skipped: readonly string[],
  drawn: ReadonlyMap<string, DrawnVolume>,
  enabled: boolean,
) {
  const layer = useRef<RoofMeshLayer | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    const current = new RoofMeshLayer()
    map.addLayer(current, labelAnchor(map))
    layer.current = current
    return () => {
      if (map.getLayer(ROOF_MESH_LAYER)) map.removeLayer(ROOF_MESH_LAYER)
      layer.current = null
    }
  }, [mapRef, ready, enabled])
  useEffect(() => {
    const map = mapRef.current
    const current = layer.current
    if (!ready || !map || !current || !enabled) return
    const build = () => {
      if (grow(map) <= 0) return
      const skip = new Set(skipped)
      const own = sceneCandidates(scene, skip, drawn)
      for (const feature of scene?.features ?? []) skip.add(feature.properties.building_id)
      const center = map.getCenter()
      const inputs = roofInputs(
        map,
        [...own, ...tileCandidates(map, skip)],
        [center.lng, center.lat],
      )
      const mesh = buildRoofMesh(inputs, [center.lng, center.lat])
      current.setMesh(mesh)
      markMeshBuildings(map, mesh.covered)
      hideMeshedSceneVolumes(map, mesh.covered)
      hideMeshedContext(map, mesh.covered)
      if (map.getLayer(ROOF_MESH_LAYER)) map.moveLayer(ROOF_MESH_LAYER, labelAnchor(map))
      if (map.getLayer(WINDOW_LAYER)) map.moveLayer(WINDOW_LAYER, labelAnchor(map))
    }
    const zoom = () => current.setGrow(grow(map))
    zoom()
    map.on("zoom", zoom)
    const unwatch = watchRoofTriggers(map, build)
    return () => {
      map.off("zoom", zoom)
      unwatch()
    }
  }, [mapRef, ready, scene, skipped, drawn, enabled])
}
