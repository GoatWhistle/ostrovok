import type { ExpressionSpecification, FilterSpecification, Map as MapLibreMap } from "maplibre-gl"
import { labelAnchor } from "../basemap-labels"
import { FLAT_ROOF } from "../roof-forms/layer"

const ROOFS = [
  {
    id: "toy-overview-roofs",
    owner: "overview-volumes",
    source: "sochi-map",
    layer: "buildings",
    min: 14,
    max: 16,
  },
  { id: "toy-scene-roofs", owner: "scene-volumes", source: "scene-buildings", min: 16, max: 24 },
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
  if (!map.getLayer(roof.id)) {
    const height = map.getPaintProperty(roof.owner, "fill-extrusion-height") as
      | ExpressionSpecification
      | number
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
          "fill-extrusion-base": height,
          "fill-extrusion-height": ["+", height, 0.25],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        },
      },
      labelAnchor(map),
    )
  }
  if (map.getPaintProperty(roof.id, "fill-extrusion-color") !== color)
    map.setPaintProperty(roof.id, "fill-extrusion-color", color)
  if (JSON.stringify(map.getFilter(roof.id)) !== JSON.stringify(filter))
    map.setFilter(roof.id, filter ?? null)
}

export function renderAppearanceRoofs(
  map: MapLibreMap,
  color: ExpressionSpecification | string | undefined,
) {
  for (const roof of ROOFS) renderRoof(map, roof, color)
}
