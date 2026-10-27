import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "./basemap-labels"

export function renderOverviewBuildings(
  map: MapLibreMap,
  color: ExpressionSpecification | string,
  excluded: readonly string[],
) {
  const filter: ExpressionSpecification = [
    "all",
    [">", ["to-number", ["get", "height_m"], 0], 0],
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
      source: "sochi-map",
      "source-layer": "buildings",
      minzoom: 14,
      maxzoom: 16,
      filter,
      paint: {
        "fill-extrusion-color": color,
        "fill-extrusion-height": ["max", 0, ["to-number", ["get", "height_m"], 0]],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 1,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    labelAnchor(map),
  )
}
