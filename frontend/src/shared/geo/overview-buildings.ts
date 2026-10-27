import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "./basemap-labels"

const SOURCE = "sochi-map"
const SOURCE_LAYER = "buildings"
const SCENE_STATE = "scene"
const ESTIMATED_HEIGHT_M = 6.4
const marked = new WeakMap<MapLibreMap, Set<string>>()
const HEIGHT: ExpressionSpecification = [
  "max",
  0,
  ["to-number", ["coalesce", ["get", "height_m"], ESTIMATED_HEIGHT_M], ESTIMATED_HEIGHT_M],
]

export const IN_SCENE: ExpressionSpecification = ["boolean", ["feature-state", SCENE_STATE], false]
export const OVERVIEW_HEIGHT: ExpressionSpecification = ["case", IN_SCENE, 0, HEIGHT]

export function markSceneBuildings(map: MapLibreMap, ids: readonly string[]) {
  if (!map.getSource(SOURCE)) return
  const next = new Set(ids)
  const previous = marked.get(map) ?? new Set<string>()
  for (const id of previous)
    if (!next.has(id))
      map.removeFeatureState({ source: SOURCE, sourceLayer: SOURCE_LAYER, id }, SCENE_STATE)
  for (const id of next)
    if (!previous.has(id))
      map.setFeatureState(
        { source: SOURCE, sourceLayer: SOURCE_LAYER, id },
        { [SCENE_STATE]: true },
      )
  marked.set(map, next)
}

export function renderOverviewBuildings(
  map: MapLibreMap,
  color: ExpressionSpecification | string,
  excluded: readonly string[],
) {
  const filter: ExpressionSpecification = [
    "all",
    [">", HEIGHT, 0],
    ["!", ["in", ["get", "id"], ["literal", excluded]]],
  ]
  if (map.getLayer("overview-volumes")) {
    map.setFilter("overview-volumes", filter)
    map.setPaintProperty("overview-volumes", "fill-extrusion-color", color)
    return
  }
  map.addLayer(
    {
      id: "overview-volumes",
      type: "fill-extrusion",
      source: SOURCE,
      "source-layer": SOURCE_LAYER,
      minzoom: 14,
      filter,
      paint: {
        "fill-extrusion-color": color,
        "fill-extrusion-height": OVERVIEW_HEIGHT,
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 1,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    labelAnchor(map),
  )
}
