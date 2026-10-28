import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { PATH, roadWidth } from "../ground/road-widths"
import { WORLD_WATER_FADE_TO } from "../world/water-layers"

const COAST_FROM = 8
const LIGHT_OPACITY = 0.7
const NIGHT_LIGHT_OPACITY = 0.95
const LIGHT_WIDTH = 1.8
const NIGHT_LIGHT_WIDTH = 1.6

export interface BasemapColors {
  readonly sand: string
  readonly building: string
  readonly buildingLine: string
  readonly roadCasing: string
  readonly road: string
  readonly roadLight: string
  readonly roadGlow: string
  readonly coast: string
}

const LIT: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  ["motorway", "trunk", "primary", "secondary", "tertiary", "residential"],
  true,
  false,
]

function lightWidth(night: number): ExpressionSpecification {
  const widest = LIGHT_WIDTH * (1 + (NIGHT_LIGHT_WIDTH - 1) * night)
  return ["interpolate", ["linear"], ["zoom"], 13, 0.4, 18, widest]
}

function lightOpacity(night: number): number {
  return LIGHT_OPACITY + (NIGHT_LIGHT_OPACITY - LIGHT_OPACITY) * night
}

function paintBasemap(map: MapLibreMap, colors: BasemapColors, night: number) {
  map.setPaintProperty("base-beaches", "fill-color", colors.sand)
  map.setPaintProperty("base-buildings", "fill-color", colors.building)
  map.setPaintProperty("base-buildings", "fill-outline-color", colors.buildingLine)
  map.setPaintProperty("base-roads-casing", "line-color", colors.roadCasing)
  map.setPaintProperty("base-roads", "line-color", colors.road)
  map.setPaintProperty("base-roads-glow", "line-color", colors.roadGlow)
  map.setPaintProperty("base-roads-light", "line-color", colors.roadLight)
  map.setPaintProperty("base-roads-light", "line-width", lightWidth(night))
  map.setPaintProperty("base-roads-light", "line-opacity", lightOpacity(night))
  map.setPaintProperty("base-coastline", "line-color", colors.coast)
}

export function renderBasemap(map: MapLibreMap, colors: BasemapColors, night = 0) {
  if (map.getSource("sochi-map")) {
    paintBasemap(map, colors, night)
    return
  }
  map.addSource("sochi-map", {
    type: "vector",
    tiles: [`${window.location.origin}/api/v1/map/tiles/{z}/{x}/{y}.pbf?v=lod-v4`],
    minzoom: 2,
    promoteId: { buildings: "id", landcover: "id" },
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
    minzoom: 10,
    paint: { "fill-color": colors.building, "fill-outline-color": colors.buildingLine },
  })
  map.addLayer({
    id: "base-roads-glow",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    minzoom: 13,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.roadGlow,
      "line-width": roadWidth(8),
      "line-blur": roadWidth(2),
      "line-opacity": 0.45,
    },
  })
  map.addLayer({
    id: "base-roads-casing",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    filter: ["!", PATH],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colors.roadCasing, "line-width": roadWidth(2.4) },
  })
  map.addLayer({
    id: "base-roads",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colors.road, "line-width": roadWidth() },
  })
  map.addLayer({
    id: "base-roads-light",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    minzoom: 13,
    filter: LIT,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.roadLight,
      "line-width": lightWidth(night),
      "line-opacity": lightOpacity(night),
    },
  })
  map.addLayer({
    id: "base-coastline",
    type: "line",
    source: "sochi-map",
    "source-layer": "coastline",
    minzoom: COAST_FROM,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.coast,
      "line-width": ["interpolate", ["linear"], ["zoom"], COAST_FROM, 1.2, 13, 1.5],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        COAST_FROM,
        0,
        WORLD_WATER_FADE_TO,
        0.9,
      ],
    },
  })
}
