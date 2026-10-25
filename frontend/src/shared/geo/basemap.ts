import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"

export interface BasemapColors {
  readonly sand: string
  readonly building: string
  readonly buildingLine: string
  readonly roadCasing: string
  readonly road: string
  readonly coast: string
}

const MAJOR: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  ["motorway", "trunk", "primary", "secondary", "tertiary"],
  true,
  false,
]

function roadWidth(minor: [number, number], major: [number, number]): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    ["case", MAJOR, major[0], minor[0]],
    17,
    ["case", MAJOR, major[1], minor[1]],
  ]
}

function paintBasemap(map: MapLibreMap, colors: BasemapColors) {
  map.setPaintProperty("base-beaches", "fill-color", colors.sand)
  map.setPaintProperty("base-buildings", "fill-color", colors.building)
  map.setPaintProperty("base-buildings", "fill-outline-color", colors.buildingLine)
  map.setPaintProperty("base-roads-casing", "line-color", colors.roadCasing)
  map.setPaintProperty("base-roads", "line-color", colors.road)
  map.setPaintProperty("base-coastline", "line-color", colors.coast)
}

export function renderBasemap(map: MapLibreMap, colors: BasemapColors) {
  if (map.getSource("sochi-map")) {
    paintBasemap(map, colors)
    return
  }
  map.addSource("sochi-map", {
    type: "vector",
    tiles: [`${window.location.origin}/api/v1/map/tiles/{z}/{x}/{y}.pbf`],
    minzoom: 8,
    maxzoom: 19,
  })
  map.addLayer({
    id: "base-beaches",
    type: "fill",
    source: "sochi-map",
    "source-layer": "beaches",
    paint: { "fill-color": colors.sand, "fill-opacity": 0.95 },
  })
  map.addLayer({
    id: "base-buildings",
    type: "fill",
    source: "sochi-map",
    "source-layer": "buildings",
    minzoom: 15,
    paint: { "fill-color": colors.building, "fill-outline-color": colors.buildingLine },
  })
  map.addLayer({
    id: "base-roads-casing",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colors.roadCasing, "line-width": roadWidth([1.2, 6], [2, 10]) },
  })
  map.addLayer({
    id: "base-roads",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colors.road, "line-width": roadWidth([0.8, 4.2], [1.4, 7.5]) },
  })
  map.addLayer({
    id: "base-coastline",
    type: "line",
    source: "sochi-map",
    "source-layer": "coastline",
    paint: { "line-color": colors.coast, "line-width": 1.5 },
  })
}
