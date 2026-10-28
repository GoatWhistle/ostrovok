import type { Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "./basemap-labels"

export interface ShoreColors {
  readonly shallows: string
  readonly foam: string
  readonly pier: string
}

const SHALLOWS = "base-shallows"
const FOAM = "base-foam"
const PIERS = "base-piers"
const PIER_HEIGHT = 1.4

function addShoreLayers(map: MapLibreMap, colors: ShoreColors) {
  const below = map.getLayer("base-beaches") ? "base-beaches" : undefined
  map.addLayer(
    {
      id: SHALLOWS,
      type: "line",
      source: "sochi-map",
      "source-layer": "coastline",
      minzoom: 11,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": colors.shallows,
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 11, 3, 18, 220],
        "line-offset": ["interpolate", ["exponential", 2], ["zoom"], 11, 1.5, 18, 110],
        "line-blur": ["interpolate", ["exponential", 2], ["zoom"], 11, 2, 18, 160],
        "line-opacity": 0.75,
      },
    },
    below,
  )
  map.addLayer(
    {
      id: FOAM,
      type: "line",
      source: "sochi-map",
      "source-layer": "coastline",
      minzoom: 13,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": colors.foam,
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 13, 0.8, 18, 9],
        "line-offset": ["interpolate", ["exponential", 2], ["zoom"], 13, 0.6, 18, 6],
        "line-blur": ["interpolate", ["exponential", 2], ["zoom"], 13, 0.6, 18, 5],
        "line-opacity": 0.85,
      },
    },
    below,
  )
  map.addLayer(
    {
      id: PIERS,
      type: "fill-extrusion",
      source: "sochi-map",
      "source-layer": "landcover",
      minzoom: 14,
      filter: ["==", ["get", "class"], "pier"],
      paint: {
        "fill-extrusion-color": colors.pier,
        "fill-extrusion-height": PIER_HEIGHT,
        "fill-extrusion-base": 0,
        "fill-extrusion-vertical-gradient": false,
      },
    },
    labelAnchor(map),
  )
}

export function renderShore(map: MapLibreMap, colors: ShoreColors) {
  if (!map.getSource("sochi-map")) return
  if (!map.getLayer(SHALLOWS)) addShoreLayers(map, colors)
  map.setPaintProperty(SHALLOWS, "line-color", colors.shallows)
  map.setPaintProperty(FOAM, "line-color", colors.foam)
  map.setPaintProperty(PIERS, "fill-extrusion-color", colors.pier)
}
