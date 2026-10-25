import type { Map as MapLibreMap } from "maplibre-gl"

interface BasemapColors {
  beach: string
  baseBuilding: string
  roadCasing: string
  road: string
  coast: string
}

export function renderBasemap(map: MapLibreMap, colors: BasemapColors) {
  if (map.getSource("sochi-map")) {
    map.setPaintProperty("base-beaches", "fill-color", colors.beach)
    map.setPaintProperty("base-buildings", "fill-color", colors.baseBuilding)
    map.setPaintProperty("base-roads-casing", "line-color", colors.roadCasing)
    map.setPaintProperty("base-roads", "line-color", colors.road)
    map.setPaintProperty("base-coastline", "line-color", colors.coast)
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
    paint: { "fill-color": colors.beach, "fill-opacity": 0.9 },
  })
  map.addLayer({
    id: "base-buildings",
    type: "fill",
    source: "sochi-map",
    "source-layer": "buildings",
    minzoom: 15,
    paint: { "fill-color": colors.baseBuilding, "fill-opacity": 0.6 },
  })
  map.addLayer({
    id: "base-roads-casing",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    paint: {
      "line-color": colors.roadCasing,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 17, 4.5],
    },
  })
  map.addLayer({
    id: "base-roads",
    type: "line",
    source: "sochi-map",
    "source-layer": "roads",
    paint: {
      "line-color": colors.road,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 17, 2.8],
    },
  })
  map.addLayer({
    id: "base-coastline",
    type: "line",
    source: "sochi-map",
    "source-layer": "coastline",
    paint: { "line-color": colors.coast, "line-width": 3 },
  })
}
