import type { FeatureCollection } from "geojson"
import type { Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"
import { updateSource } from "../map-layers"

const SOURCE = "selected-hotel-halo"
const GLOW = "selected-hotel-glow"
const RING = "selected-hotel-ring"

export function renderHotelHalo(map: MapLibreMap, data: FeatureCollection, color: string) {
  updateSource(map, SOURCE, data)
  if (map.getLayer(GLOW)) {
    map.setPaintProperty(GLOW, "line-color", color)
    map.setPaintProperty(RING, "line-color", color)
    return
  }
  const before = map.getLayer("buildings-volume") ? "buildings-volume" : labelAnchor(map)
  map.addLayer(
    {
      id: GLOW,
      type: "line",
      source: SOURCE,
      layout: { "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 14, 6, 18, 40],
        "line-blur": ["interpolate", ["exponential", 2], ["zoom"], 14, 5, 18, 32],
        "line-opacity": 0.38,
      },
    },
    before,
  )
  map.addLayer(
    {
      id: RING,
      type: "line",
      source: SOURCE,
      layout: { "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 14, 1, 18, 3],
        "line-offset": ["interpolate", ["exponential", 2], ["zoom"], 14, -1.2, 18, -9],
        "line-opacity": 0.9,
      },
    },
    before,
  )
}
