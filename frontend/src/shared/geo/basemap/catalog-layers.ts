import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl"
import { renderOverviewBuildings } from "../buildings/overview-buildings"

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
  readonly poi: ExpressionSpecification | string
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
  resolve: (token: string, item: CatalogClass) => string | undefined,
  fallback: Fallback,
): ClassColors {
  const colored = classes.flatMap((item) => {
    const color = resolve(item.style.fill ?? "", item)
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
    poi: classMatch(
      pairs((item) => item.layer === "poi" || item.layer === "prop"),
      defaults("poi", fallback.park),
    ),
  }
}

const SETTLEMENT_FROM = 9

function addCatalogLayers(map: MapLibreMap, colors: ClassColors) {
  const below = map.getLayer("base-beaches") ? "base-beaches" : undefined
  map.addLayer(
    {
      id: "base-landcover",
      type: "fill",
      source: "sochi-map",
      "source-layer": "landcover",
      minzoom: SETTLEMENT_FROM,
      paint: {
        "fill-color": colors.ground,
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          SETTLEMENT_FROM,
          0,
          SETTLEMENT_FROM + 1,
          0.9,
        ],
      },
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.6, 19, 5.5],
        "circle-opacity": 0.92,
        "circle-pitch-alignment": "map",
        "circle-blur": 0.15,
      },
    },
    map.getLayer("base-roads-glow") ? "base-roads-glow" : undefined,
  )
  map.addLayer(
    {
      id: "base-tree-rows",
      type: "line",
      source: "sochi-map",
      "source-layer": "tree_rows",
      minzoom: 14,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.prop,
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.4, 17, 6, 19, 14],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.45, 16, 0.8],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 19, 4],
      },
    },
    map.getLayer("base-trees") ? "base-trees" : undefined,
  )
  map.addLayer({
    id: "base-props",
    type: "circle",
    source: "sochi-map",
    "source-layer": "props",
    minzoom: 16,
    paint: {
      "circle-color": colors.poi,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        16,
        ["match", ["get", "kind"], ["waterfall", "viewpoint", "lighthouse"], 3.2, 1.8],
        19,
        ["match", ["get", "kind"], ["waterfall", "viewpoint", "lighthouse"], 8, 4.5],
      ],
      "circle-opacity": 0.9,
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 16, 0, 18, 0.8],
      "circle-stroke-color": colors.prop,
      "circle-pitch-alignment": "map",
    },
  })
}

export function renderCatalogLayers(
  map: MapLibreMap,
  colors: ClassColors,
  excluded: readonly string[] = [],
  water: ExpressionSpecification | string = colors.ground,
) {
  if (!map.getSource("sochi-map")) return
  if (!map.getLayer("base-landcover")) addCatalogLayers(map, colors)
  renderOverviewBuildings(map, colors.volume, excluded)
  map.setPaintProperty("base-landcover", "fill-color", colors.ground)
  map.setPaintProperty("base-water", "fill-color", water)
  map.setPaintProperty("base-trees", "circle-color", colors.prop)
  map.setPaintProperty("base-tree-rows", "line-color", colors.prop)
  map.setPaintProperty("base-props", "circle-color", colors.poi)
  map.setPaintProperty("base-props", "circle-stroke-color", colors.prop)
  if (map.getLayer("base-buildings"))
    map.setPaintProperty("base-buildings", "fill-color", colors.volume)
  if (map.getLayer("base-roads")) map.setPaintProperty("base-roads", "line-color", colors.roads)
}
