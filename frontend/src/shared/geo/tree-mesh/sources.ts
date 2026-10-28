import type { Geometry } from "geojson"
import type { Map as MapLibreMap } from "maplibre-gl"
import { Occupancy } from "./occupancy"
import { fillCells, type Local, RULES, type Tree, type TreeRule, treeAt } from "./scatter"

type LonLat = readonly [number, number]

const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6371008.8
const MAX_TREES = 24000
const ELEVATION_CELL = 24
const SEA_LEVEL = 0.4
const OSM_RULE: TreeRule = { spacing: 1, conifer: 0.1, bush: 0, keep: 1, height: [7, 12] }
const ROAD_HALF: Readonly<Record<string, number>> = {
  motorway: 10,
  trunk: 9,
  primary: 8,
  secondary: 7,
  tertiary: 6,
  residential: 4.5,
  unclassified: 4.5,
  living_street: 4,
  service: 3,
  pedestrian: 4,
  footway: 1.4,
  path: 1.4,
  cycleway: 1.6,
  steps: 1.4,
  track: 2,
}

export interface TreeField {
  readonly origin: LonLat
  readonly trees: readonly (Tree & { readonly z: number })[]
}

function mercator([lon, lat]: LonLat): Local {
  const sin = Math.sin((lat * Math.PI) / 180)
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)]
}

function unmercator([x, y]: Local): LonLat {
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI
  return [x * 360 - 180, lat]
}

function rings(geometry: Geometry): LonLat[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as unknown as LonLat[][]]
  if (geometry.type === "MultiPolygon") return geometry.coordinates as unknown as LonLat[][][]
  return []
}

function lines(geometry: Geometry): LonLat[][] {
  if (geometry.type === "LineString") return [geometry.coordinates as unknown as LonLat[]]
  if (geometry.type === "MultiLineString") return geometry.coordinates as unknown as LonLat[][]
  return []
}

interface Frame {
  readonly origin: LonLat
  readonly scale: number
  readonly middle: Local
  readonly radius: number
  readonly world: (point: LonLat) => Local
}

type Query = (sourceLayer: string) => ReturnType<MapLibreMap["querySourceFeatures"]>

function occupancyFor(query: Query, frame: Frame): Occupancy {
  const occupancy = new Occupancy(frame.middle, frame.radius)
  for (const road of query("roads")) {
    const half = ROAD_HALF[String(road.properties.kind)] ?? 3
    for (const line of lines(road.geometry)) occupancy.line(line.map(frame.world), half)
  }
  for (const building of query("buildings"))
    for (const polygon of rings(building.geometry))
      occupancy.polygon(polygon.map((ring) => ring.map(frame.world)))
  return occupancy
}

function scatter(query: Query, frame: Frame, occupancy: Occupancy): Map<string, Tree> {
  const seen = new Map<string, Tree>()
  const near = (x: number, y: number) =>
    Math.hypot(x - frame.middle[0], y - frame.middle[1]) <= frame.radius
  for (const cover of query("landcover")) {
    const rule = RULES[String(cover.properties.class)]
    if (!rule) continue
    const visit = (i: number, j: number) => {
      const key = `${rule.spacing}:${i}:${j}`
      if (seen.has(key)) return
      const tree = treeAt(i, j, rule)
      if (tree && near(tree.x, tree.y) && !occupancy.taken(tree.x, tree.y)) seen.set(key, tree)
    }
    for (const polygon of rings(cover.geometry))
      fillCells(
        polygon.map((ring) => ring.map(frame.world)),
        rule.spacing,
        visit,
      )
  }
  for (const point of query("trees")) {
    if (point.geometry.type !== "Point") continue
    const [x, y] = frame.world(point.geometry.coordinates as [number, number])
    const i = Math.round(x)
    const j = Math.round(y)
    const tree = treeAt(i, j, OSM_RULE)
    if (tree && near(x, y)) seen.set(`osm:${i}:${j}`, { ...tree, x, y })
  }
  return seen
}

const STREET_KINDS = new Set([
  "secondary",
  "tertiary",
  "residential",
  "living_street",
  "unclassified",
  "pedestrian",
])
const STREET_STEP = 11
const STREET_GAP = 2.4
const STREET_RULE: TreeRule = { spacing: 1, conifer: 0.06, bush: 0, keep: 0.72, height: [6, 10] }

function streetSide(line: readonly Local[], half: number, visit: (x: number, y: number) => void) {
  let carry = STREET_STEP / 2
  for (let index = 0; index + 1 < line.length; index += 1) {
    const [x1, y1] = line[index] ?? [0, 0]
    const [x2, y2] = line[index + 1] ?? [0, 0]
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length === 0) continue
    const nx = (y1 - y2) / length
    const ny = (x2 - x1) / length
    for (let at = carry; at < length; at += STREET_STEP) {
      const x = x1 + ((x2 - x1) * at) / length
      const y = y1 + ((y2 - y1) * at) / length
      visit(x + nx * half, y + ny * half)
      visit(x - nx * half, y - ny * half)
    }
    carry = (carry - length) % STREET_STEP
    if (carry < 0) carry += STREET_STEP
  }
}

function streetTrees(query: Query, frame: Frame, occupancy: Occupancy, seen: Map<string, Tree>) {
  for (const road of query("roads")) {
    const kind = String(road.properties.kind)
    if (!STREET_KINDS.has(kind)) continue
    const half = (ROAD_HALF[kind] ?? 3) + STREET_GAP
    for (const line of lines(road.geometry))
      streetSide(line.map(frame.world), half, (x, y) => {
        const i = Math.round(x / 3)
        const j = Math.round(y / 3)
        const key = `street:${i}:${j}`
        if (seen.has(key) || occupancy.taken(x, y)) return
        if (Math.hypot(x - frame.middle[0], y - frame.middle[1]) > frame.radius) return
        const tree = treeAt(i, j, STREET_RULE)
        if (tree) seen.set(key, { ...tree, x, y })
      })
  }
}

export function treeField(map: MapLibreMap, radius: number): TreeField {
  const center = map.getCenter()
  const origin: LonLat = [center.lng, center.lat]
  const scale = EARTH_CIRCUMFERENCE_M * Math.cos((Math.round(center.lat) * Math.PI) / 180)
  const world = (point: LonLat): Local => {
    const [x, y] = mercator(point)
    return [x * scale, y * scale]
  }
  const middle = world(origin)
  const frame: Frame = { origin, scale, middle, radius, world }
  const query: Query = (sourceLayer) => map.querySourceFeatures("sochi-map", { sourceLayer })
  const occupancy = occupancyFor(query, frame)
  const seen = scatter(query, frame, occupancy)
  streetTrees(query, frame, occupancy, seen)
  const ox = middle[0] / scale
  const oy = middle[1] / scale
  const metres = EARTH_CIRCUMFERENCE_M * Math.cos((origin[1] * Math.PI) / 180)
  const ground = new Map<string, number>()
  const wet = map.getTerrain() !== null
  const elevation = (x: number, y: number, at: LonLat) => {
    const key = `${Math.round(x / ELEVATION_CELL)}:${Math.round(y / ELEVATION_CELL)}`
    const cached = ground.get(key)
    if (cached !== undefined) return cached
    const value = map.queryTerrainElevation([...at]) ?? 0
    ground.set(key, value)
    return value
  }
  const trees = [...seen.values()]
    .map((tree) => ({ tree, distance: Math.hypot(tree.x - middle[0], tree.y - middle[1]) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_TREES)
    .map(({ tree }) => {
      const mx = tree.x / scale
      const my = tree.y / scale
      const z = elevation(tree.x, tree.y, unmercator([mx, my]))
      return { ...tree, x: (mx - ox) * metres, y: (my - oy) * metres, z }
    })
    .filter((tree) => !wet || tree.z > SEA_LEVEL)
  return { origin, trees }
}
