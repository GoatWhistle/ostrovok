import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"

const ROOFS = [
  {
    id: "toy-overview-roofs",
    owner: "overview-volumes",
    source: "sochi-map",
    layer: "buildings",
    min: 14,
    max: 16,
  },
  { id: "toy-scene-roofs", owner: "scene-volumes", source: "scene-buildings", min: 16, max: 24 },
  { id: "toy-context-roofs", owner: "buildings-volume", source: "buildings", min: 14, max: 24 },
] as const

function renderRoof(map: MapLibreMap, roof: (typeof ROOFS)[number], color: string | undefined) {
  if (!color) {
    if (map.getLayer(roof.id)) map.removeLayer(roof.id)
    return
  }
  if (!map.getSource(roof.source) || !map.getLayer(roof.owner)) return
  const filter = map.getFilter(roof.owner)
  if (!map.getLayer(roof.id)) {
    const height = map.getPaintProperty(roof.owner, "fill-extrusion-height") as
      | ExpressionSpecification
      | number
    map.addLayer(
      {
        id: roof.id,
        type: "fill-extrusion",
        source: roof.source,
        ...("layer" in roof ? { "source-layer": roof.layer } : {}),
        minzoom: roof.min,
        maxzoom: roof.max,
        ...(filter ? { filter } : {}),
        paint: {
          "fill-extrusion-color": color,
          "fill-extrusion-base": height,
          "fill-extrusion-height": ["+", height, 0.25],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        },
      },
      labelAnchor(map),
    )
  }
  if (map.getPaintProperty(roof.id, "fill-extrusion-color") !== color)
    map.setPaintProperty(roof.id, "fill-extrusion-color", color)
  if (JSON.stringify(map.getFilter(roof.id)) !== JSON.stringify(filter))
    map.setFilter(roof.id, filter ?? null)
}

export function renderAppearanceRoofs(map: MapLibreMap, color: string | undefined) {
  for (const roof of ROOFS) renderRoof(map, roof, color)
}
