import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"

export interface SunPosition {
  readonly azimuth: number
  readonly altitude: number
}

export interface TerrainColors {
  readonly land: string
  readonly park: string
  readonly sand: string
  readonly building: string
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
  readonly rock: string
}

export type LightMode = "day" | "dusk" | "night"

const DEM_TILES = "/api/v1/map/terrain/{z}/{x}/{y}.png"
const RELIEF_OPACITY: Readonly<Record<LightMode, number>> = { day: 1, dusk: 1, night: 1 }
const LIGHT_INTENSITY: Readonly<Record<LightMode, number>> = { day: 0.5, dusk: 0.7, night: 0.15 }

export function lightMode(altitude: number): LightMode {
  if (altitude < -6) return "night"
  if (altitude < 8) return "dusk"
  return "day"
}

export function scenePalette(colors: TerrainColors, mode: LightMode) {
  if (mode === "night")
    return { sea: colors.seaNight, sky: colors.skyNight, horizon: colors.horizonNight }
  if (mode === "dusk")
    return { sea: colors.seaDusk, sky: colors.skyDusk, horizon: colors.horizonDusk }
  return { sea: colors.sea, sky: colors.sky, horizon: colors.horizon }
}

function reliefRamp(colors: TerrainColors, sea: string): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    0,
    sea,
    0.6,
    colors.sand,
    6,
    colors.land,
    260,
    colors.land,
    900,
    colors.park,
    2200,
    colors.rock,
  ]
}

function demSource(map: MapLibreMap, id: string) {
  if (map.getSource(id)) return
  map.addSource(id, {
    type: "raster-dem",
    tiles: [`${window.location.origin}${DEM_TILES}`],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 14,
    encoding: "mapbox",
  })
}

function addTerrainLayers(map: MapLibreMap, colors: TerrainColors, sea: string) {
  if (map.getLayer("sochi-relief")) return
  demSource(map, "sochi-dem")
  demSource(map, "sochi-dem-shade")
  map.addLayer({
    id: "sochi-relief",
    type: "color-relief",
    source: "sochi-dem-shade",
    paint: { "color-relief-color": reliefRamp(colors, sea), "color-relief-opacity": 1 },
  })
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
  map.setTerrain({ source: "sochi-dem", exaggeration: 1.15 })
}

export function renderTerrain(map: MapLibreMap, colors: TerrainColors, sun: SunPosition) {
  const mode = lightMode(sun.altitude)
  const { sea, sky, horizon } = scenePalette(colors, mode)
  addTerrainLayers(map, colors, sea)
  map.setPaintProperty("sochi-relief", "color-relief-color", reliefRamp(colors, sea))
  map.setPaintProperty("sochi-relief", "color-relief-opacity", RELIEF_OPACITY[mode])
  map.setPaintProperty("sochi-hillshade", "hillshade-shadow-color", colors.hillShadow)
  map.setPaintProperty("sochi-hillshade", "hillshade-highlight-color", colors.hillHighlight)
  map.setPaintProperty("sochi-hillshade", "hillshade-accent-color", colors.hillShadow)
  map.setPaintProperty("sochi-hillshade", "hillshade-illumination-direction", sun.azimuth)
  map.setPaintProperty("canvas", "background-color", sea)
  map.setLight({
    anchor: "map",
    position: [1.15, sun.azimuth, Math.max(5, Math.min(110, 90 - sun.altitude))],
    color: mode === "dusk" ? colors.horizonDusk : colors.sunlight,
    intensity: LIGHT_INTENSITY[mode],
  })
  map.setSky({
    "sky-color": sky,
    "horizon-color": horizon,
    "fog-color": sea,
    "sky-horizon-blend": 0.55,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.5,
  })
}
