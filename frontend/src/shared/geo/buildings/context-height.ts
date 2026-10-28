import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { MESH_FROM } from "./overview-buildings"

export const HOTEL: ExpressionSpecification = ["boolean", ["get", "is_hotel"], false]
const CONTEXT_HEIGHT: ExpressionSpecification = ["max", 0, ["to-number", ["get", "height_m"], 0]]
const meshed = new WeakMap<MapLibreMap, readonly string[]>()

export function contextHeight(map: MapLibreMap, lift = 0): ExpressionSpecification {
  const raised: ExpressionSpecification = ["+", CONTEXT_HEIGHT, lift]
  const covered = [...(meshed.get(map) ?? [])]
  return [
    "step",
    ["zoom"],
    raised,
    MESH_FROM,
    [
      "case",
      [
        "all",
        ["!", HOTEL],
        ["in", ["coalesce", ["get", "building_id"], ["get", "id"]], ["literal", covered]],
      ],
      0,
      raised,
    ],
  ]
}

export function hideMeshedContext(map: MapLibreMap, covered: readonly string[]) {
  meshed.set(map, covered)
  if (map.getLayer("buildings-volume"))
    map.setPaintProperty("buildings-volume", "fill-extrusion-height", contextHeight(map))
}
