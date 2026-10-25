import type { Map as MapLibreMap } from "maplibre-gl"

export interface SunPosition {
  readonly azimuth: number
  readonly altitude: number
}

export interface TerrainColors {
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
}

export function lightMode(altitude: number) {
  if (altitude < -6) return "night"
  if (altitude < 8) return "dusk"
  return "day"
}

function scenePalette(colors: TerrainColors, mode: string) {
  return {
    sea: mode === "night" ? colors.seaNight : mode === "dusk" ? colors.seaDusk : colors.sea,
    sky: mode === "night" ? colors.skyNight : mode === "dusk" ? colors.skyDusk : colors.sky,
    horizon:
      mode === "night"
        ? colors.horizonNight
        : mode === "dusk"
          ? colors.horizonDusk
          : colors.horizon,
  }
}

export function renderTerrain(map: MapLibreMap, colors: TerrainColors, sun: SunPosition) {
  const mode = lightMode(sun.altitude)
  const { sea, sky, horizon } = scenePalette(colors, mode)
  addTerrainSources(map, colors)
  map.setPaintProperty(
    "sochi-relief",
    "raster-opacity",
    mode === "night" ? 0.34 : mode === "dusk" ? 0.72 : 1,
  )
  map.setPaintProperty("sochi-hillshade", "hillshade-shadow-color", colors.hillShadow)
  map.setPaintProperty("sochi-hillshade", "hillshade-highlight-color", colors.hillHighlight)
  map.setPaintProperty("sochi-hillshade", "hillshade-illumination-direction", sun.azimuth)
  map.setPaintProperty("canvas", "background-color", sea)
  map.setLight({
    anchor: "map",
    position: [1.15, sun.azimuth, Math.max(5, Math.min(110, 90 - sun.altitude))],
    color: mode === "dusk" ? colors.horizonDusk : colors.hillHighlight,
    intensity: mode === "night" ? 0.15 : mode === "dusk" ? 0.7 : 0.5,
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

function addTerrainSources(map: MapLibreMap, colors: TerrainColors) {
  if (!map.getSource("sochi-dem")) {
    map.addSource("sochi-dem", {
      type: "raster-dem",
      tiles: [`${window.location.origin}/api/v1/map/terrain/{z}/{x}/{y}.png`],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 14,
      encoding: "mapbox",
    })
    map.addSource("sochi-relief", {
      type: "raster",
      tiles: [`${window.location.origin}/api/v1/map/relief/{z}/{x}/{y}.png`],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 14,
    })
    map.addLayer({
      id: "sochi-relief",
      type: "raster",
      source: "sochi-relief",
      paint: { "raster-opacity": 1 },
    })
    map.addLayer({
      id: "sochi-hillshade",
      type: "hillshade",
      source: "sochi-dem",
      paint: {
        "hillshade-exaggeration": 0.55,
        "hillshade-shadow-color": colors.hillShadow,
        "hillshade-highlight-color": colors.hillHighlight,
        "hillshade-accent-color": colors.hillShadow,
      },
    })
    map.setTerrain({ source: "sochi-dem", exaggeration: 1.15 })
  }
}
