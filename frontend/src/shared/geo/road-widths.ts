import type { ExpressionSpecification } from "maplibre-gl"

type Rank = "major" | "mid" | "minor" | "service" | "walk" | "path"

const KINDS: Readonly<Record<Rank, readonly string[]>> = {
  major: ["motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"],
  mid: ["secondary", "tertiary", "secondary_link", "tertiary_link"],
  minor: ["residential", "unclassified", "living_street", "road"],
  service: ["service", "track"],
  walk: ["pedestrian"],
  path: ["footway", "path", "cycleway", "steps", "bridleway", "corridor"],
}

const WIDTH_AT_19: Readonly<Record<Rank, number>> = {
  major: 58,
  mid: 44,
  minor: 30,
  service: 18,
  walk: 22,
  path: 8,
}

const STOPS = [12, 13, 14, 15, 16, 17, 18, 19] as const
const PATH_FROM = 14

function width(rank: Rank, zoom: number, extra: number): number {
  if (rank === "path" && zoom < PATH_FROM) return 0
  const base = WIDTH_AT_19[rank] * 2 ** (zoom - 19)
  const outline = rank === "path" ? 0 : extra * Math.min(1, Math.max(0, (zoom - 13) / 4))
  return Math.round((base + outline + (zoom < 14 ? 0.5 : 0)) * 100) / 100
}

function byRank(zoom: number, extra: number): ExpressionSpecification {
  const ranks = Object.keys(KINDS) as Rank[]
  return [
    "match",
    ["get", "kind"],
    ...ranks.flatMap((rank) => [[...KINDS[rank]], width(rank, zoom, extra)]),
    width("minor", zoom, extra),
  ] as unknown as ExpressionSpecification
}

export function roadWidth(extra = 0): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...STOPS.flatMap((zoom) => [zoom, byRank(zoom, extra)]),
  ] as unknown as ExpressionSpecification
}

export const PATH: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  [...KINDS.path],
  true,
  false,
]
