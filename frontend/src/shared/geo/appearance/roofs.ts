import type { ExpressionSpecification, FilterSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap/basemap-labels"
import { contextHeight, HOTEL } from "../buildings/context-height"
import { sceneHeight } from "../night-city/night-layers"
import { overviewHeight } from "../buildings/overview-buildings"
import { FLAT_ROOF } from "../roof-forms/layer"

const CAP = 0.25

const ROOFS = [
  {
    id: "toy-overview-roofs",
    owner: "overview-volumes",
    source: "sochi-map",
    layer: "buildings",
    min: 14,
    max: 24,
  },
  { id: "toy-scene-roofs", owner: "scene-volumes", source: "scene-buildings", min: 14, max: 24 },
  { id: "toy-context-roofs", owner: "buildings-volume", source: "buildings", min: 14, max: 24 },
] as const

export function roofPaint(colors: readonly string[]): ExpressionSpecification | string | undefined {
  if (colors.length === 0) return undefined
  const first = colors[0]
  if (first === undefined) return undefined
  if (colors.length === 1) return first
  const branches = colors.flatMap((color, index) => [index, color])
  const seed = [
    "+",
    ["round", ["*", 10, ["to-number", ["get", "height_m"], 0]]],
    ["length", ["to-string", ["get", "id"]]],
  ]
  return [
    "match",
    ["%", seed, colors.length],
    ...branches,
    first,
  ] as unknown as ExpressionSpecification
}

function roofFilter(
  roof: (typeof ROOFS)[number],
  owner: FilterSpecification | null | undefined,
): FilterSpecification | undefined {
  if (roof.owner === "overview-volumes") return owner ?? undefined
  return owner ? (["all", owner, FLAT_ROOF] as FilterSpecification) : FLAT_ROOF
}

function ownerHeight(map: MapLibreMap, owner: string, lift: number): ExpressionSpecification {
  if (owner === "overview-volumes") return overviewHeight(lift)
  if (owner === "scene-volumes") return sceneHeight(map, lift)
  return contextHeight(map, lift)
}

function syncPaint(
  map: MapLibreMap,
  id: string,
  name: "fill-extrusion-color" | "fill-extrusion-base" | "fill-extrusion-height",
  value: ExpressionSpecification | string,
) {
  if (JSON.stringify(map.getPaintProperty(id, name)) !== JSON.stringify(value))
    map.setPaintProperty(id, name, value)
}

function renderRoof(
  map: MapLibreMap,
  roof: (typeof ROOFS)[number],
  color: ExpressionSpecification | string | undefined,
) {
  if (!color) {
    if (map.getLayer(roof.id)) map.removeLayer(roof.id)
    return
  }
  if (!map.getSource(roof.source) || !map.getLayer(roof.owner)) return
  const filter = roofFilter(roof, map.getFilter(roof.owner) || undefined)
  const base = ownerHeight(map, roof.owner, 0)
  const top = ownerHeight(map, roof.owner, CAP)
  if (!map.getLayer(roof.id)) {
    map.addLayer(
      {
        id: roof.id,
        type: "fill-extrusion",
        source: roof.source,
        ...("layer" in roof ? { "source-layer": roof.layer } : {}),
        minzoom: roof.min,
        maxzoom: roof.max,
        ...(filter ? { filter } : {}),
        paint: {
          "fill-extrusion-color": color,
          "fill-extrusion-base": base,
          "fill-extrusion-height": top,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        },
      },
      labelAnchor(map),
    )
  }
  syncPaint(map, roof.id, "fill-extrusion-color", color)
  syncPaint(map, roof.id, "fill-extrusion-base", base)
  syncPaint(map, roof.id, "fill-extrusion-height", top)
  if (JSON.stringify(map.getFilter(roof.id)) !== JSON.stringify(filter))
    map.setFilter(roof.id, filter ?? null)
}

export function renderAppearanceRoofs(
  map: MapLibreMap,
  color: ExpressionSpecification | string | undefined,
  accent?: string,
) {
  for (const roof of ROOFS) {
    const marked =
      color && accent && roof.owner === "buildings-volume"
        ? (["case", HOTEL, accent, color] as ExpressionSpecification)
        : color
    renderRoof(map, roof, marked)
  }
}
