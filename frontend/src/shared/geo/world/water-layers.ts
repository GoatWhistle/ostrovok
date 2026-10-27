import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from "maplibre-gl"

export interface WaterTier {
  readonly id: string
  readonly data: string
  readonly minzoom?: number
  readonly maxzoom?: number
}

export const WORLD_WATER_FADE_FROM = 7.75
export const WORLD_WATER_FADE_TO = 8.25
const COAST_FADE_FROM = 7.5

const AREA: FilterSpecification = ["!", ["has", "seam"]]
const SEAMS: FilterSpecification = ["has", "seam"]

const FADE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  WORLD_WATER_FADE_FROM,
  1,
  WORLD_WATER_FADE_TO,
  0,
]

const COAST_OPACITY: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  0.55,
  6,
  0.85,
  COAST_FADE_FROM,
  0.85,
  WORLD_WATER_FADE_FROM,
  0,
]

const COAST_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  0.6,
  6,
  1,
  WORLD_WATER_FADE_FROM,
  1.3,
]

const SEAM_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  2.5,
  WORLD_WATER_FADE_TO,
  3.5,
]

function within(tier: WaterTier, maxzoom: number): { minzoom?: number; maxzoom: number } {
  const top = Math.min(tier.maxzoom ?? maxzoom, maxzoom)
  return tier.minzoom === undefined ? { maxzoom: top } : { minzoom: tier.minzoom, maxzoom: top }
}

export function waterLayers(tier: WaterTier, sea: string, coast: string): LayerSpecification[] {
  return [
    {
      id: `${tier.id}-fill`,
      type: "fill",
      source: tier.id,
      ...within(tier, WORLD_WATER_FADE_TO),
      filter: AREA,
      paint: { "fill-color": sea, "fill-opacity": FADE },
    },
    {
      id: `${tier.id}-coast`,
      type: "line",
      source: tier.id,
      ...within(tier, WORLD_WATER_FADE_FROM),
      filter: AREA,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": coast, "line-width": COAST_WIDTH, "line-opacity": COAST_OPACITY },
    },
    {
      id: `${tier.id}-seam`,
      type: "line",
      source: tier.id,
      ...within(tier, WORLD_WATER_FADE_TO),
      filter: SEAMS,
      layout: { "line-cap": "butt" },
      paint: { "line-color": sea, "line-width": SEAM_WIDTH, "line-opacity": FADE },
    },
  ]
}
