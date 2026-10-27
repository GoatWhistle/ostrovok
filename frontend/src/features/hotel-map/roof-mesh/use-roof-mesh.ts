import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import type { MapRenderScene } from "@/entities/map-data"
import { labelAnchor } from "@/shared/geo/basemap-labels"
import { ROOF_MESH_LAYER, RoofMeshLayer } from "@/shared/geo/roof-mesh/layer"
import { buildRoofMesh } from "@/shared/geo/roof-mesh/mesh"
import { type RoofCandidate, roofInputs, tileCandidates } from "@/shared/geo/roof-mesh/sources"
import { watchRoofTriggers } from "@/shared/geo/roof-mesh/triggers"

const GROW_FROM = 14.6
const GROW_SPAN = 0.8

function sceneCandidates(scene: MapRenderScene | undefined, skip: ReadonlySet<string>) {
  return (scene?.features ?? []).flatMap((feature): RoofCandidate[] => {
    const id = feature.properties.building_id
    if (skip.has(id) || feature.properties.hotel_id) return []
    return [
      {
        id,
        geometry: feature.geometry as RoofCandidate["geometry"],
        height: feature.properties.render_height_m,
        levels: feature.properties.levels,
      },
    ]
  })
}

function grow(map: MapLibreMap) {
  return Math.min(1, Math.max(0, (map.getZoom() - GROW_FROM) / GROW_SPAN))
}

export function useRoofMesh(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  scene: MapRenderScene | undefined,
  skipped: readonly string[],
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
    if (!ready || !map || !current) return
    const build = () => {
      if (grow(map) <= 0) return
      const skip = new Set(skipped)
      const own = sceneCandidates(scene, skip)
      for (const feature of scene?.features ?? []) skip.add(feature.properties.building_id)
      const center = map.getCenter()
      const inputs = roofInputs(
        map,
        [...own, ...tileCandidates(map, skip)],
        [center.lng, center.lat],
      )
      current.setMesh(buildRoofMesh(inputs, [center.lng, center.lat]))
      if (map.getLayer(ROOF_MESH_LAYER)) map.moveLayer(ROOF_MESH_LAYER, labelAnchor(map))
    }
    const zoom = () => current.setGrow(grow(map))
    zoom()
    map.on("zoom", zoom)
    const unwatch = watchRoofTriggers(map, build)
    return () => {
      map.off("zoom", zoom)
      unwatch()
    }
  }, [mapRef, ready, scene, skipped, enabled])
}
