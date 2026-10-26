import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"

const SURF_LAYER = "base-surf"
const SOURCE = "sochi-map"
const DASHES: readonly (readonly number[])[] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

const WIDTH: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 9, 2, 16, 10]
const OFFSET: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 9, 2, 16, 9]

export function renderSurf(map: MapLibreMap, color: string) {
  if (!map.getSource(SOURCE)) return
  if (map.getLayer(SURF_LAYER)) {
    map.setPaintProperty(SURF_LAYER, "line-color", color)
    return
  }
  map.addLayer(
    {
      id: SURF_LAYER,
      type: "line",
      source: SOURCE,
      "source-layer": "coastline",
      minzoom: 9,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": WIDTH,
        "line-offset": OFFSET,
        "line-blur": 1.5,
        "line-opacity": 0.9,
        "line-dasharray": [...(DASHES[0] ?? [])],
      },
    },
    "base-coastline",
  )
}

export function animateSurf(map: MapLibreMap, stepMs: number): () => void {
  let step = 0
  const timer = window.setInterval(() => {
    if (!map.getLayer(SURF_LAYER) || map.getZoom() < 9) return
    step = (step + 1) % DASHES.length
    map.setPaintProperty(SURF_LAYER, "line-dasharray", [...(DASHES[step] ?? [])])
  }, stepMs)
  return () => window.clearInterval(timer)
}
