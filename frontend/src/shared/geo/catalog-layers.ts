import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { renderOverviewBuildings } from "./overview-buildings"

export interface CatalogClass {
  readonly key: string
  readonly layer: "ground" | "volume" | "prop" | "poi"
  readonly match: readonly unknown[]
  readonly style: Readonly<Record<string, string>>
}

export interface ClassColors {
  readonly ground: ExpressionSpecification | string
  readonly volume: ExpressionSpecification | string
  readonly roads: ExpressionSpecification | string
  readonly prop: ExpressionSpecification | string
}

interface Fallback {
  readonly land: string
  readonly building: string
  readonly road: string
  readonly park: string
}

const HEX = /^#[0-9a-f]{6}$/i
const ROAD_PREFIX = "road_"

function classMatch(
  pairs: readonly (readonly [string, string])[],
  fallback: string,
): ExpressionSpecification | string {
  const [first, ...rest] = pairs
  if (!first) return fallback
  return ["match", ["get", "class"], first[0], first[1], ...rest.flat(), fallback]
}

export function classColors(
  classes: readonly CatalogClass[],
  resolve: (token: string) => string | undefined,
  fallback: Fallback,
): ClassColors {
  const colored = classes.flatMap((item) => {
    const color = resolve(item.style.fill ?? "")
    return color && HEX.test(color) ? [{ item, color }] : []
  })
  const pairs = (keep: (item: CatalogClass) => boolean) =>
    colored.filter(({ item }) => keep(item)).map(({ item, color }) => [item.key, color] as const)
  const defaults = (layer: CatalogClass["layer"], color: string) =>
    colored.find(({ item }) => item.layer === layer && item.match.length === 0)?.color ?? color
  return {
    ground: classMatch(
      pairs((item) => item.layer === "ground" && !item.key.startsWith(ROAD_PREFIX)),
      defaults("ground", fallback.land),
    ),
    volume: classMatch(
      pairs((item) => item.layer === "volume"),
      defaults("volume", fallback.building),
    ),
    roads: classMatch(
      pairs((item) => item.key.startsWith(ROAD_PREFIX)),
      fallback.road,
    ),
    prop: classMatch(
      pairs((item) => item.layer === "prop"),
      defaults("prop", fallback.park),
    ),
  }
}

function addCatalogLayers(map: MapLibreMap, colors: ClassColors) {
  const below = map.getLayer("base-beaches") ? "base-beaches" : undefined
  map.addLayer(
    {
      id: "base-landcover",
      type: "fill",
      source: "sochi-map",
      "source-layer": "landcover",
      minzoom: 2,
      paint: { "fill-color": colors.ground, "fill-opacity": 0.9 },
    },
    below,
  )
  map.addLayer(
    {
      id: "base-water",
      type: "fill",
      source: "sochi-map",
      "source-layer": "water",
      minzoom: 2,
      paint: { "fill-color": colors.ground },
    },
    below,
  )
  map.addLayer(
    {
      id: "base-trees",
      type: "circle",
      source: "sochi-map",
      "source-layer": "trees",
      minzoom: 15,
      paint: {
        "circle-color": colors.prop,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 19, 5],
        "circle-opacity": 0.85,
      },
    },
    map.getLayer("base-roads-glow") ? "base-roads-glow" : undefined,
  )
}

export function renderCatalogLayers(
  map: MapLibreMap,
  colors: ClassColors,
  excluded: readonly string[] = [],
) {
  if (!map.getSource("sochi-map")) return
  if (!map.getLayer("base-landcover")) addCatalogLayers(map, colors)
  renderOverviewBuildings(map, colors.volume, excluded)
  map.setPaintProperty("base-landcover", "fill-color", colors.ground)
  map.setPaintProperty("base-water", "fill-color", colors.ground)
  map.setPaintProperty("base-trees", "circle-color", colors.prop)
  if (map.getLayer("base-buildings"))
    map.setPaintProperty("base-buildings", "fill-color", colors.volume)
  if (map.getLayer("base-roads")) map.setPaintProperty("base-roads", "line-color", colors.roads)
}
