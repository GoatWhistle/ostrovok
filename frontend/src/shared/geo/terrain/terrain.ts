import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { mixHex } from "../color/hex-color"
import { type MoonLight, type NightLight, skyPalette, sunLight } from "../sun/sun-light"
import { renderWorldWater } from "../world/water"
import { WORLD_WATER_FADE_FROM } from "../world/water-layers"
import { retryingTileUrl } from "./dem-protocol"
import { addSnowLayers, paintSnow, rgba } from "./snow"

export interface SunPosition {
  readonly azimuth: number
  readonly altitude: number
  readonly moon?: MoonLight
}

export interface TerrainColors {
  readonly land: string
  readonly park: string
  readonly sand: string
  readonly building: string
  readonly coast: string
  readonly sea: string
  readonly seaDusk: string
  readonly seaNight: string
  readonly sky: string
  readonly skyDusk: string
  readonly skyNight: string
  readonly horizon: string
  readonly horizonDusk: string
  readonly horizonNight: string
  readonly hillShadow: string
  readonly hillHighlight: string
  readonly sunlight: string
  readonly sunLow: string
  readonly moonlight: string
  readonly rock: string
  readonly snow: string
  readonly meadow: string
}

export type LightMode = "day" | "dusk" | "night"

export const TERRAIN_TILE_VERSION = "2"
const HORIZON_SEA = 0.5
const FOG_LAND = 0.45
const DEM_TILES = `/api/v1/map/terrain/{z}/{x}/{y}.png?v=${TERRAIN_TILE_VERSION}`
const DEM_MAX_ZOOM = 14
const FALLBACK_MAX_ZOOM = 6
const TERRAIN_MIN_ZOOM = 6
const TERRAIN = { source: "sochi-dem", exaggeration: 1.15 }
const SEA_NEAR_FROM = WORLD_WATER_FADE_FROM - 0.5
const CITY_GROUND_FROM = 11
const CITY_GROUND_TO = 12
const SEA_NEAR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  SEA_NEAR_FROM,
  0,
  WORLD_WATER_FADE_FROM,
  1,
]

export function lightMode(altitude: number): LightMode {
  if (altitude < -6) return "night"
  if (altitude < 8) return "dusk"
  return "day"
}

export function scenePalette(colors: TerrainColors, altitude: number) {
  return skyPalette(colors, altitude)
}

function reliefRamp(colors: TerrainColors): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    0.6,
    colors.sand,
    8,
    colors.meadow,
    300,
    colors.land,
    900,
    colors.park,
    2200,
    colors.rock,
  ]
}

function seaRamp(sea: string): ExpressionSpecification {
  return ["interpolate", ["linear"], ["elevation"], 0, sea, 0.6, rgba(sea, 0)]
}

function groundColor(colors: TerrainColors, sea: string): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    SEA_NEAR_FROM,
    colors.land,
    WORLD_WATER_FADE_FROM,
    sea,
    CITY_GROUND_FROM,
    sea,
    CITY_GROUND_TO,
    colors.land,
  ]
}

function addRelief(
  map: MapLibreMap,
  id: string,
  source: string,
  colors: TerrainColors,
  sea: string,
) {
  map.addLayer({
    id,
    type: "color-relief",
    source,
    paint: { "color-relief-color": reliefRamp(colors), "color-relief-opacity": 1 },
  })
  map.addLayer({
    id: `${id}-sea`,
    type: "color-relief",
    source,
    minzoom: SEA_NEAR_FROM,
    paint: { "color-relief-color": seaRamp(sea), "color-relief-opacity": SEA_NEAR },
  })
}

function demSource(map: MapLibreMap, id: string, maxzoom = DEM_MAX_ZOOM) {
  if (map.getSource(id)) return
  map.addSource(id, {
    type: "raster-dem",
    tiles: [retryingTileUrl(`${window.location.origin}${DEM_TILES}`)],
    tileSize: 256,
    minzoom: 0,
    maxzoom,
    encoding: "mapbox",
  })
}

function addTerrainLayers(map: MapLibreMap, colors: TerrainColors, sea: string) {
  if (map.getLayer("sochi-relief")) return
  demSource(map, "sochi-dem-fallback", FALLBACK_MAX_ZOOM)
  demSource(map, "sochi-dem")
  demSource(map, "sochi-dem-shade")
  addRelief(map, "sochi-relief-fallback", "sochi-dem-fallback", colors, sea)
  addRelief(map, "sochi-relief", "sochi-dem-shade", colors, sea)
  map.addLayer({
    id: "sochi-hillshade",
    type: "hillshade",
    source: "sochi-dem-shade",
    paint: {
      "hillshade-exaggeration": 0.5,
      "hillshade-shadow-color": colors.hillShadow,
      "hillshade-highlight-color": colors.hillHighlight,
      "hillshade-accent-color": colors.hillShadow,
    },
  })
  addSnowLayers(map, "sochi-dem-shade", colors.snow, "sochi-hillshade")
}

export function followTerrainZoom(map: MapLibreMap, allowed = true): () => void {
  const sync = () => {
    const wanted = allowed && map.getZoom() >= TERRAIN_MIN_ZOOM
    if (wanted && !map.getTerrain()) map.setTerrain(TERRAIN)
    if (!wanted && map.getTerrain()) map.setTerrain(null)
  }
  sync()
  map.on("zoomend", sync)
  return () => map.off("zoomend", sync)
}

export function renderTerrain(
  map: MapLibreMap,
  colors: TerrainColors,
  sun: SunPosition,
  contrast = 1,
  night?: NightLight,
) {
  const { sea, sky } = scenePalette(colors, sun.altitude)
  addTerrainLayers(map, colors, sea)
  for (const id of ["sochi-relief-fallback", "sochi-relief"]) {
    map.setPaintProperty(id, "color-relief-color", reliefRamp(colors))
    map.setPaintProperty(`${id}-sea`, "color-relief-color", seaRamp(sea))
  }
  renderWorldWater(map, sea, colors.coast)
  paintSnow(map, colors.snow)
  map.setPaintProperty("sochi-hillshade", "hillshade-shadow-color", colors.hillShadow)
  map.setPaintProperty("sochi-hillshade", "hillshade-highlight-color", colors.hillHighlight)
  map.setPaintProperty("sochi-hillshade", "hillshade-accent-color", colors.hillShadow)
  map.setPaintProperty("sochi-hillshade", "hillshade-illumination-direction", sun.azimuth)
  map.setPaintProperty("canvas", "background-color", groundColor(colors, sea))
  map.setLight({
    anchor: "map",
    ...sunLight(colors, sun.azimuth, sun.altitude, contrast, night),
  })
  map.setSky({
    "sky-color": sky,
    "horizon-color": mixHex(sky, sea, HORIZON_SEA),
    "fog-color": mixHex(sky, colors.land, FOG_LAND),
    "sky-horizon-blend": 0.55,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.5,
  })
}
