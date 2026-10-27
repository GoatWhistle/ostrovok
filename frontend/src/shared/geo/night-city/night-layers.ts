import type { FeatureCollection } from "geojson"
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"
import { updateSource } from "../map-layers"

export interface NightColors {
  readonly lamp: string
  readonly cityGlow: string
}

const LIGHT_ON_ALTITUDE = 2
const FULL_NIGHT_ALTITUDE = -6
const LIT_ROADS: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  ["primary", "secondary", "tertiary", "residential", "living_street", "pedestrian", "trunk"],
  true,
  false,
]
const BUILT_UP: ExpressionSpecification = [
  "match",
  ["get", "class"],
  ["residential", "commercial", "retail", "industrial"],
  true,
  false,
]

export function nightFactor(sunAltitude: number): number {
  const amount = (LIGHT_ON_ALTITUDE - sunAltitude) / (LIGHT_ON_ALTITUDE - FULL_NIGHT_ALTITUDE)
  return Math.min(1, Math.max(0, amount))
}

const DAY_WINDOWS_FROM = 16
const NIGHT_WINDOWS_FROM = 14.6

export function windowFade(zoom: number, night = 0): number {
  const from = DAY_WINDOWS_FROM + (NIGHT_WINDOWS_FROM - DAY_WINDOWS_FROM) * night
  return Math.min(1, Math.max(0, zoom - from))
}

function addNightLayers(map: MapLibreMap, colors: NightColors) {
  const before = map.getLayer("base-roads-light") ? "base-roads-light" : labelAnchor(map)
  map.addLayer(
    {
      id: "night-glow",
      type: "fill",
      source: "sochi-map",
      "source-layer": "landcover",
      minzoom: 9,
      maxzoom: 15,
      filter: BUILT_UP,
      layout: { visibility: "none" },
      paint: { "fill-color": colors.cityGlow, "fill-opacity": 0 },
    },
    map.getLayer("base-water") ? "base-water" : before,
  )
  map.addLayer(
    {
      id: "night-lamps",
      type: "line",
      source: "sochi-map",
      "source-layer": "roads",
      minzoom: 14.5,
      filter: LIT_ROADS,
      layout: { "line-cap": "round", visibility: "none" },
      paint: {
        "line-color": colors.lamp,
        "line-width": ["interpolate", ["linear"], ["zoom"], 15, 2.2, 19, 6],
        "line-dasharray": [0.05, 7],
        "line-blur": 1.2,
        "line-opacity": 0,
      },
    },
    before,
  )
}

export function renderNightLights(map: MapLibreMap, night: number, colors: NightColors) {
  if (!map.getSource("sochi-map")) return
  if (!map.getLayer("night-lamps")) addNightLayers(map, colors)
  const visibility = night > 0 ? "visible" : "none"
  map.setLayoutProperty("night-lamps", "visibility", visibility)
  map.setLayoutProperty("night-glow", "visibility", visibility)
  map.setPaintProperty("night-lamps", "line-color", colors.lamp)
  map.setPaintProperty("night-lamps", "line-opacity", 0.9 * night)
  map.setPaintProperty("night-glow", "fill-color", colors.cityGlow)
  map.setPaintProperty("night-glow", "fill-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    9,
    0.32 * night,
    14.9,
    0,
  ])
}

export function renderSceneVolumes(
  map: MapLibreMap,
  data: FeatureCollection,
  color: ExpressionSpecification | string,
  excluded: readonly string[],
) {
  updateSource(map, "scene-buildings", data)
  const filter: ExpressionSpecification = [
    "!",
    ["in", ["get", "building_id"], ["literal", excluded]],
  ]
  if (map.getLayer("scene-volumes")) {
    map.setFilter("scene-volumes", filter)
    map.setPaintProperty("scene-volumes", "fill-extrusion-color", color)
    return
  }
  map.addLayer(
    {
      id: "scene-volumes",
      type: "fill-extrusion",
      source: "scene-buildings",
      minzoom: 14,
      filter,
      paint: {
        "fill-extrusion-color": color,
        "fill-extrusion-height": ["get", "render_height_m"],
        "fill-extrusion-base": ["get", "min_height_m"],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.95,
      },
    },
    labelAnchor(map),
  )
}
