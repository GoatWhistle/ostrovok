import type { Map as MapLibreMap } from "maplibre-gl"

const LAYER = "reel-noise-roads"
const SOURCE = "sochi-map"
const BUSY = ["motorway", "trunk", "primary", "secondary", "tertiary"]

export function paintNoiseRoads(map: MapLibreMap, color: string, opacity: number) {
  if (!map.getLayer(LAYER)) {
    if (!map.getSource(SOURCE)) return
    const before = map.getStyle().layers.find((layer) => layer.type === "fill-extrusion")?.id
    map.addLayer(
      {
        id: LAYER,
        type: "line",
        source: SOURCE,
        "source-layer": "roads",
        filter: ["match", ["get", "kind"], BUSY, true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color,
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 14],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 8],
          "line-opacity": 0,
        },
      },
      before,
    )
  }
  map.setPaintProperty(LAYER, "line-color", color)
  map.setPaintProperty(LAYER, "line-opacity", opacity)
}
