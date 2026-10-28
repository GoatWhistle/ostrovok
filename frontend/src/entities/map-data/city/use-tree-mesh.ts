import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect } from "react"
import { labelAnchor } from "@/shared/geo/basemap/basemap-labels"
import { watchTerrainData } from "@/shared/geo/night-city/terrain-watch"
import { WINDOW_LAYER } from "@/shared/geo/night-city/window-layer"
import { watchRoofTriggers } from "@/shared/geo/roof-mesh/triggers"
import { TREE_LAYER, TreeLayer } from "@/shared/geo/tree-mesh/layer"
import { TreeClient } from "@/shared/geo/tree-mesh/tree-client"

const GROW_FROM = 14.8
const GROW_SPAN = 0.5
const BASE_RADIUS = 1100
const MIN_RADIUS = 700
const FLAT_TREES = ["base-trees", "base-trees-shadow"]

function grow(map: MapLibreMap) {
  return Math.min(1, Math.max(0, (map.getZoom() - GROW_FROM) / GROW_SPAN))
}

function hideFlatTrees(map: MapLibreMap, hidden: boolean) {
  for (const id of FLAT_TREES)
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", hidden ? "none" : "visible")
}

function raise(map: MapLibreMap) {
  if (map.getLayer(TREE_LAYER)) map.moveLayer(TREE_LAYER, labelAnchor(map))
  if (map.getLayer(WINDOW_LAYER)) map.moveLayer(WINDOW_LAYER, labelAnchor(map))
}

export function useTreeMesh(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  enabled: boolean,
) {
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    const current = new TreeLayer()
    const client = new TreeClient(map)
    map.addLayer(current, labelAnchor(map))
    const zoom = () => current.setGrow(grow(map))
    const build = async () => {
      hideFlatTrees(map, true)
      if (grow(map) <= 0) return
      const radius = Math.max(MIN_RADIUS, BASE_RADIUS * 2 ** (15 - map.getZoom()))
      const chunked = await client.build(radius)
      if (!chunked || !map.getLayer(TREE_LAYER)) return
      current.setChunks(chunked)
      raise(map)
    }
    zoom()
    map.on("zoom", zoom)
    const unwatch = watchRoofTriggers(map, () => void build())
    const unwatchGround = watchTerrainData(map, () => client.forgetGround())
    return () => {
      unwatch()
      unwatchGround()
      client.dispose()
      map.off("zoom", zoom)
      hideFlatTrees(map, false)
      if (map.getLayer(TREE_LAYER)) map.removeLayer(TREE_LAYER)
    }
  }, [mapRef, ready, enabled])
}
