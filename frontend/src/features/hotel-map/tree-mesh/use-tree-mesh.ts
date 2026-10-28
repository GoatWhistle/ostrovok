import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef } from "react"
import { labelAnchor } from "@/shared/geo/basemap-labels"
import { WINDOW_LAYER } from "@/shared/geo/night-city/window-layer"
import { watchRoofTriggers } from "@/shared/geo/roof-mesh/triggers"
import { INSTANCE_STRIDE, TREE_LAYER, TreeLayer } from "@/shared/geo/tree-mesh/layer"
import { type TreeField, treeField } from "@/shared/geo/tree-mesh/sources"

const GROW_FROM = 14.8
const GROW_SPAN = 0.5
const BASE_RADIUS = 1600
const MIN_RADIUS = 450
const FLAT_TREES = ["base-trees", "base-trees-shadow"]

function grow(map: MapLibreMap) {
  return Math.min(1, Math.max(0, (map.getZoom() - GROW_FROM) / GROW_SPAN))
}

function pack(field: TreeField) {
  const kinds = [0, 1, 2].map((kind) => field.trees.filter((tree) => tree.kind === kind))
  return {
    origin: field.origin,
    kinds: kinds.map((trees) => {
      const data = new Float32Array(trees.length * INSTANCE_STRIDE)
      trees.forEach((tree, index) => {
        data.set(
          [tree.x, tree.y, tree.z, tree.height, tree.tone, tree.spin],
          index * INSTANCE_STRIDE,
        )
      })
      return data
    }),
  }
}

function hideFlatTrees(map: MapLibreMap, hidden: boolean) {
  for (const id of FLAT_TREES)
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", hidden ? "none" : "visible")
}

export function useTreeMesh(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  enabled: boolean,
) {
  const layer = useRef<TreeLayer | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    const current = new TreeLayer()
    map.addLayer(current, labelAnchor(map))
    layer.current = current
    const zoom = () => current.setGrow(grow(map))
    const build = () => {
      hideFlatTrees(map, true)
      if (grow(map) <= 0) return
      const radius = Math.max(MIN_RADIUS, BASE_RADIUS * 2 ** (15 - map.getZoom()))
      current.setTrees(pack(treeField(map, radius)))
      if (map.getLayer(TREE_LAYER)) map.moveLayer(TREE_LAYER, labelAnchor(map))
      if (map.getLayer(WINDOW_LAYER)) map.moveLayer(WINDOW_LAYER, labelAnchor(map))
    }
    zoom()
    map.on("zoom", zoom)
    const unwatch = watchRoofTriggers(map, build)
    return () => {
      unwatch()
      map.off("zoom", zoom)
      hideFlatTrees(map, false)
      if (map.getLayer(TREE_LAYER)) map.removeLayer(TREE_LAYER)
      layer.current = null
    }
  }, [mapRef, ready, enabled])
}
