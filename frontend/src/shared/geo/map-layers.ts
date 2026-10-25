import type { FeatureCollection } from "geojson"
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
export function updateSource(map: MapLibreMap, name: string, data: FeatureCollection) {
  const existing = map.getSource<GeoJSONSource>(name)
  if (existing) existing.setData(data)
  else map.addSource(name, { type: "geojson", data })
}
export function renderBuildings(
  map: MapLibreMap,
  data: FeatureCollection,
  color: string,
  selected: string,
) {
  updateSource(map, "buildings", data)
  if (map.getLayer("buildings-volume")) return
  map.addLayer({
    id: "buildings-context",
    type: "fill",
    source: "buildings",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": ["case", ["boolean", ["get", "is_hotel"], false], selected, color],
      "fill-opacity": ["case", ["boolean", ["get", "is_hotel"], false], 0.7, 0.28],
    },
  })
  map.addLayer({
    id: "buildings-volume",
    type: "fill-extrusion",
    source: "buildings",
    filter: [
      "all",
      ["==", ["geometry-type"], "Polygon"],
      [">", ["to-number", ["get", "height_m"], 0], 0],
    ],
    paint: {
      "fill-extrusion-color": ["case", ["boolean", ["get", "is_hotel"], false], selected, color],
      "fill-extrusion-height": ["max", 0, ["to-number", ["get", "height_m"], 0]],
      "fill-extrusion-base": ["max", 0, ["to-number", ["get", "min_height_m"], 0]],
      "fill-extrusion-opacity": 0.95,
    },
  })
  map.addLayer({
    id: "buildings-outline",
    type: "line",
    source: "buildings",
    filter: ["get", "is_hotel"],
    paint: { "line-color": selected, "line-width": 3, "line-opacity": 0.9 },
  })
}
export function renderHighlights(
  map: MapLibreMap,
  data: FeatureCollection,
  color: string,
  casing: string,
) {
  updateSource(map, "highlights", data)
  if (map.getLayer("highlight-line")) return
  map.addLayer({
    id: "highlight-area",
    type: "fill",
    source: "highlights",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": color, "fill-opacity": 0.16 },
  })
  map.addLayer({
    id: "highlight-line-casing",
    type: "line",
    source: "highlights",
    filter: ["!=", ["geometry-type"], "Point"],
    paint: { "line-color": casing, "line-width": 8, "line-opacity": 0.9 },
  })
  map.addLayer({
    id: "highlight-line",
    type: "line",
    source: "highlights",
    filter: ["!=", ["geometry-type"], "Point"],
    paint: { "line-color": color, "line-width": 4 },
  })
  map.addLayer({
    id: "highlight-point",
    type: "circle",
    source: "highlights",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": color,
      "circle-radius": 7,
      "circle-stroke-width": 2,
      "circle-stroke-color": casing,
    },
  })
}
