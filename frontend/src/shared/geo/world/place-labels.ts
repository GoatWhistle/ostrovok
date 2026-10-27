import type { ExpressionSpecification, FilterSpecification, Map as MapLibreMap } from "maplibre-gl"
import { BASEMAP_PLACES_FROM, type LabelColors } from "../basemap-labels"

const SOURCE = "place-labels"
const DATA = "/data/place-labels.geojson"
const COUNTRIES = "place-labels-countries"
const CITIES = "place-labels-cities"
const ZOOM_SLACK = 1

function visibleAt(): ExpressionSpecification {
  return ["<=", ["get", "z"], ["+", ["zoom"], ZOOM_SLACK]]
}

function placeFilter(
  kinds: readonly string[],
  outsideBasemaps: ExpressionSpecification | undefined,
): FilterSpecification {
  const where: ExpressionSpecification = outsideBasemaps
    ? ["any", ["<", ["zoom"], BASEMAP_PLACES_FROM], outsideBasemaps]
    : ["literal", true]
  return ["all", ["in", ["get", "kind"], ["literal", [...kinds]]], visibleAt(), where]
}

function addLayers(map: MapLibreMap, lang: string, outsideBasemaps?: ExpressionSpecification) {
  const name: ExpressionSpecification = ["get", lang === "en" ? "en" : "ru"]
  map.addLayer({
    id: COUNTRIES,
    type: "symbol",
    source: SOURCE,
    filter: placeFilter(["country"], outsideBasemaps),
    metadata: { lang },
    layout: {
      "text-field": name,
      "text-font": ["Noto Sans Medium"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 6, 15],
      "text-transform": "uppercase",
      "text-letter-spacing": 0.08,
      "text-max-width": 8,
      "symbol-sort-key": ["get", "rank"],
    },
    paint: { "text-halo-width": 1.4 },
  })
  map.addLayer({
    id: CITIES,
    type: "symbol",
    source: SOURCE,
    filter: placeFilter(["capital", "city"], outsideBasemaps),
    metadata: { lang },
    layout: {
      "text-field": name,
      "text-font": ["Noto Sans Medium"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 8, 14],
      "text-variable-anchor": ["top", "bottom", "left", "right"],
      "text-radial-offset": 0.5,
      "icon-image": ["match", ["get", "kind"], "capital", "capital", "townspot"],
      "icon-size": 0.7,
      "symbol-sort-key": ["get", "rank"],
    },
    paint: { "text-halo-width": 1.4 },
  })
}

export function renderPlaceLabels(
  map: MapLibreMap,
  colors: LabelColors,
  lang: string,
  outsideBasemaps?: ExpressionSpecification,
) {
  if (!map.getGlyphs()) return
  if (!map.getSource(SOURCE))
    map.addSource(SOURCE, { type: "geojson", data: `${window.location.origin}${DATA}` })
  const current = map.getLayer(COUNTRIES)?.metadata as { lang?: unknown } | undefined
  if (current && current.lang !== lang) {
    map.removeLayer(COUNTRIES)
    map.removeLayer(CITIES)
  }
  if (!map.getLayer(COUNTRIES)) addLayers(map, lang, outsideBasemaps)
  for (const id of [COUNTRIES, CITIES]) {
    map.setPaintProperty(id, "text-color", id === COUNTRIES ? colors.label : colors.labelStrong)
    map.setPaintProperty(id, "text-halo-color", colors.labelHalo)
    map.moveLayer(id)
  }
}
