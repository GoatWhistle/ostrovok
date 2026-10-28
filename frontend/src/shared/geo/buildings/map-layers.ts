import type { Feature, FeatureCollection } from "geojson"
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap/basemap-labels"
import { contextRoofs } from "../roof-forms/layer"
import { contextHeight, HOTEL } from "./context-height"

export interface BuildingColors {
  readonly building: string
  readonly buildingLine: string
  readonly buildingVolume: string
  readonly hotelVolume: string
  readonly hotelSelected: string
}

export interface HighlightColors {
  readonly fact: string
  readonly factLine: string
  readonly route: string
  readonly routeGlow: string
  readonly land: string
}

const POLYGON: ExpressionSpecification = ["==", ["geometry-type"], "Polygon"]

export function updateSource(map: MapLibreMap, name: string, data: FeatureCollection) {
  const existing = map.getSource<GeoJSONSource>(name)
  if (existing) existing.setData(data)
  else map.addSource(name, { type: "geojson", data })
}

function paintBuildings(map: MapLibreMap, colors: BuildingColors) {
  map.setPaintProperty("buildings-context", "fill-color", [
    "case",
    HOTEL,
    colors.hotelVolume,
    colors.building,
  ])
  map.setPaintProperty("buildings-volume", "fill-extrusion-color", [
    "case",
    HOTEL,
    colors.hotelVolume,
    colors.buildingVolume,
  ])
  map.setPaintProperty("buildings-outline", "line-color", colors.hotelSelected)
}

export function renderBuildings(map: MapLibreMap, data: FeatureCollection, colors: BuildingColors) {
  const before = labelAnchor(map)
  updateSource(map, "buildings", contextRoofs(data))
  if (map.getLayer("buildings-volume")) {
    paintBuildings(map, colors)
    return
  }
  map.addLayer(
    {
      id: "buildings-context",
      type: "fill",
      source: "buildings",
      filter: POLYGON,
      paint: {
        "fill-color": ["case", HOTEL, colors.hotelVolume, colors.building],
        "fill-outline-color": colors.buildingLine,
        "fill-opacity": ["case", HOTEL, 0.9, 0.6],
      },
    },
    before,
  )
  map.addLayer(
    {
      id: "buildings-volume",
      type: "fill-extrusion",
      source: "buildings",
      filter: ["all", POLYGON, [">", ["to-number", ["get", "height_m"], 0], 0]],
      paint: {
        "fill-extrusion-color": ["case", HOTEL, colors.hotelVolume, colors.buildingVolume],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-height": contextHeight(map),
        "fill-extrusion-base": ["max", 0, ["to-number", ["get", "min_height_m"], 0]],
        "fill-extrusion-opacity": 0.95,
      },
    },
    before,
  )
  map.addLayer(
    {
      id: "buildings-outline",
      type: "line",
      source: "buildings",
      filter: HOTEL,
      paint: { "line-color": colors.hotelSelected, "line-width": 2 },
    },
    before,
  )
}

function isRoute(feature: Feature): boolean {
  const type = feature.geometry.type
  return (
    (type === "LineString" || type === "MultiLineString") && feature.properties?.kind === "route"
  )
}

export function routeGradient(color: string, progress: number): ExpressionSpecification {
  if (progress >= 1) return ["step", ["line-progress"], color, 2, color]
  return ["step", ["line-progress"], color, Math.max(progress, 0.0001), "transparent"]
}

function addHighlightLayers(map: MapLibreMap, colors: HighlightColors) {
  const before = labelAnchor(map)
  map.addLayer(
    {
      id: "highlight-area",
      type: "fill",
      source: "highlights",
      filter: POLYGON,
      paint: { "fill-color": colors.fact, "fill-opacity": 0.45 },
    },
    before,
  )
  map.addLayer(
    {
      id: "highlight-line",
      type: "line",
      source: "highlights",
      filter: ["!=", ["geometry-type"], "Point"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colors.factLine, "line-width": 2.5 },
    },
    before,
  )
  map.addLayer(
    {
      id: "route-glow",
      filter: ["!=", ["get", "mode"], "straight"],
      type: "line",
      source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-gradient": routeGradient(colors.routeGlow, 0),
        "line-width": 14,
        "line-blur": 8,
        "line-opacity": 0.55,
      },
    },
    before,
  )
  map.addLayer(
    {
      id: "route-casing",
      filter: ["!=", ["get", "mode"], "straight"],
      type: "line",
      source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-gradient": routeGradient(colors.land, 0),
        "line-width": 9,
        "line-opacity": 0.35,
      },
    },
    before,
  )
  map.addLayer(
    {
      id: "route-line",
      filter: ["!=", ["get", "mode"], "straight"],
      type: "line",
      source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-gradient": routeGradient(colors.route, 0), "line-width": 4.5 },
    },
    before,
  )
  map.addLayer(
    {
      id: "route-straight",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "mode"], "straight"],
      paint: { "line-color": colors.route, "line-width": 3, "line-dasharray": [2, 2] },
    },
    before,
  )
  map.addLayer(
    {
      id: "highlight-point",
      type: "circle",
      source: "highlights",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": colors.fact,
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": colors.factLine,
      },
    },
    before,
  )
}

export function renderHighlights(
  map: MapLibreMap,
  data: FeatureCollection,
  colors: HighlightColors,
): boolean {
  const routes = data.features.filter(isRoute)
  const facts = data.features.filter((feature) => !isRoute(feature))
  updateSource(map, "highlights", { type: "FeatureCollection", features: facts })
  const existing = map.getSource<GeoJSONSource>("routes")
  const routeData: FeatureCollection = { type: "FeatureCollection", features: routes }
  if (existing) existing.setData(routeData)
  else map.addSource("routes", { type: "geojson", data: routeData, lineMetrics: true })
  if (!map.getLayer("highlight-area")) addHighlightLayers(map, colors)
  map.setPaintProperty("highlight-area", "fill-color", colors.fact)
  map.setPaintProperty("highlight-line", "line-color", colors.factLine)
  map.setPaintProperty("highlight-point", "circle-color", colors.fact)
  map.setPaintProperty("highlight-point", "circle-stroke-color", colors.factLine)
  return routes.length > 0
}

export function paintRoute(map: MapLibreMap, colors: HighlightColors, progress: number) {
  if (!map.getLayer("route-line")) return
  map.setPaintProperty("route-straight", "line-color", colors.route)
  map.setPaintProperty("route-straight", "line-opacity", progress)
  map.setPaintProperty("route-glow", "line-gradient", routeGradient(colors.routeGlow, progress))
  map.setPaintProperty("route-casing", "line-gradient", routeGradient(colors.land, progress))
  map.setPaintProperty("route-line", "line-gradient", routeGradient(colors.route, progress))
}
