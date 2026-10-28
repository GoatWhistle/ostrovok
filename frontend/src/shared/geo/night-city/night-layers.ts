import type { FeatureCollection } from "geojson"
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"
import { updateSource } from "../map-layers"
import { MESH_FROM } from "../overview-buildings"
import { ensureLampSprite, LAMP_ICON } from "./lamp-sprite"

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
  ensureLampSprite(map)
  map.addLayer(
    {
      id: "night-lamps",
      type: "symbol",
      source: "sochi-map",
      "source-layer": "roads",
      minzoom: 14.5,
      filter: LIT_ROADS,
      layout: {
        visibility: "none",
        "symbol-placement": "line",
        "symbol-spacing": ["interpolate", ["exponential", 2], ["zoom"], 15, 24, 19, 160],
        "icon-image": LAMP_ICON,
        "icon-size": ["interpolate", ["exponential", 2], ["zoom"], 15, 0.32, 19, 1.4],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "map",
        "icon-rotation-alignment": "map",
        "icon-offset": [0, -14],
      },
      paint: { "icon-color": colors.lamp, "icon-opacity": 0 },
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
  map.setPaintProperty("night-lamps", "icon-color", colors.lamp)
  map.setPaintProperty("night-lamps", "icon-opacity", 0.95 * night)
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

const meshed = new WeakMap<MapLibreMap, readonly string[]>()

export function sceneHeight(map: MapLibreMap, lift = 0): ExpressionSpecification {
  const raised: ExpressionSpecification = ["+", ["get", "render_height_m"], lift]
  const covered = meshed.get(map) ?? []
  return [
    "step",
    ["zoom"],
    raised,
    MESH_FROM,
    ["case", ["in", ["get", "building_id"], ["literal", [...covered]]], 0, raised],
  ]
}

export function hideMeshedSceneVolumes(map: MapLibreMap, covered: readonly string[]) {
  meshed.set(map, covered)
  if (map.getLayer("scene-volumes"))
    map.setPaintProperty("scene-volumes", "fill-extrusion-height", sceneHeight(map))
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
        "fill-extrusion-height": sceneHeight(map),
        "fill-extrusion-base": ["get", "min_height_m"],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.95,
      },
    },
    labelAnchor(map),
  )
}
