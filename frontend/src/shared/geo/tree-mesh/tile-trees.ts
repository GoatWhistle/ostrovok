import type { MvtFeature, MvtLayer } from "./mvt"
import { Occupancy } from "./occupancy"
import type { TreePolicy } from "./policy"
import { fillCells, type Local, type Tree, treeAt } from "./scatter"

export const TILE_ZOOM = 15
export const TILE_STRIDE = 6
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6371008.8
const MARGIN_M = 24

export interface TileTrees {
  readonly key: string
  readonly data: Float64Array
  readonly stats: Readonly<Record<string, number>>
}

interface Frame {
  readonly x0: number
  readonly y0: number
  readonly size: number
  readonly scale: number
  readonly project: (feature: MvtFeature, extent: number) => Local[][]
}

function frameOf(x: number, y: number): Frame {
  const n = 2 ** TILE_ZOOM
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI
  const scale = EARTH_CIRCUMFERENCE_M * Math.cos((Math.round(lat) * Math.PI) / 180)
  const size = scale / n
  const x0 = x * size
  const y0 = y * size
  const project = (feature: MvtFeature, extent: number) =>
    feature.parts.map((part) => {
      const points: Local[] = []
      for (let index = 0; index + 1 < part.length; index += 2)
        points.push([
          x0 + ((part[index] ?? 0) / extent) * size,
          y0 + ((part[index + 1] ?? 0) / extent) * size,
        ])
      return points
    })
  return { x0, y0, size, scale, project }
}

function each(
  layers: Map<string, MvtLayer>,
  name: string,
  visit: (feature: MvtFeature, extent: number) => void,
) {
  const layer = layers.get(name)
  if (layer) for (const feature of layer.features) visit(feature, layer.extent)
}

function occupancyOf(layers: Map<string, MvtLayer>, frame: Frame, policy: TreePolicy) {
  const half = frame.size / 2
  const grid = new Occupancy([frame.x0 + half, frame.y0 + half], half + MARGIN_M)
  const masked = new Set(policy.maskedGround)
  const polygon = (feature: MvtFeature, extent: number) =>
    grid.polygon(frame.project(feature, extent))
  each(layers, "roads", (road, extent) => {
    const width = policy.roadHalf[String(road.props.kind)] ?? 3
    for (const line of frame.project(road, extent)) grid.line(line, width)
  })
  each(layers, "buildings", polygon)
  each(layers, "landcover", (cover, extent) => {
    if (masked.has(String(cover.props.class))) polygon(cover, extent)
  })
  if (policy.maskWater) {
    each(layers, "water", polygon)
    each(layers, "beaches", polygon)
    each(layers, "coastline", (coast, extent) => {
      for (const line of frame.project(coast, extent)) grid.line(line, policy.coastHalf)
    })
  }
  return grid
}

function streetSide(
  line: readonly Local[],
  half: number,
  step: number,
  visit: (x: number, y: number) => void,
) {
  let carry = step / 2
  for (let index = 0; index + 1 < line.length; index += 1) {
    const [x1, y1] = line[index] ?? [0, 0]
    const [x2, y2] = line[index + 1] ?? [0, 0]
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length === 0) continue
    const nx = (y1 - y2) / length
    const ny = (x2 - x1) / length
    for (let at = carry; at < length; at += step) {
      const x = x1 + ((x2 - x1) * at) / length
      const y = y1 + ((y2 - y1) * at) / length
      visit(x + nx * half, y + ny * half)
      visit(x - nx * half, y - ny * half)
    }
    carry = (((carry - length) % step) + step) % step
  }
}

class Collector {
  readonly trees: Tree[] = []
  readonly stats: Record<string, number> = {}
  private readonly seen = new Set<string>()

  private readonly frame: Frame

  constructor(frame: Frame) {
    this.frame = frame
  }

  inside(x: number, y: number): boolean {
    const { x0, y0, size } = this.frame
    return x >= x0 && y >= y0 && x < x0 + size && y < y0 + size
  }

  add(key: string, source: string, tree: Tree) {
    if (this.seen.has(key) || !this.inside(tree.x, tree.y)) return
    this.seen.add(key)
    this.trees.push(tree)
    this.stats[source] = (this.stats[source] ?? 0) + 1
  }
}

function scatter(
  layers: Map<string, MvtLayer>,
  frame: Frame,
  grid: Occupancy,
  policy: TreePolicy,
  out: Collector,
) {
  each(layers, "landcover", (cover, extent) => {
    const name = String(cover.props.class)
    const rule = policy.rules[name]
    if (!rule) return
    fillCells(frame.project(cover, extent), rule.spacing, (i, j) => {
      const tree = treeAt(i, j, rule)
      if (tree && !grid.taken(tree.x, tree.y)) out.add(`${rule.spacing}:${i}:${j}`, name, tree)
    })
  })
  each(layers, "trees", (point, extent) => {
    for (const [x, y] of frame.project(point, extent).flat()) {
      const tree = treeAt(Math.round(x), Math.round(y), policy.osmRule)
      if (tree) out.add(`osm:${Math.round(x)}:${Math.round(y)}`, "osm", { ...tree, x, y })
    }
  })
}

function streets(
  layers: Map<string, MvtLayer>,
  frame: Frame,
  grid: Occupancy,
  policy: TreePolicy,
  out: Collector,
) {
  if (policy.streetNeedsGround && (layers.get("landcover")?.features.length ?? 0) === 0) return
  const kinds = new Set(policy.streetKinds)
  each(layers, "roads", (road, extent) => {
    const kind = String(road.props.kind)
    if (!kinds.has(kind)) return
    const half = (policy.roadHalf[kind] ?? 3) + policy.streetGap
    for (const line of frame.project(road, extent))
      streetSide(line, half, policy.streetStep, (x, y) => {
        if (grid.taken(x, y)) return
        const i = Math.round(x / 3)
        const j = Math.round(y / 3)
        const tree = treeAt(i, j, policy.streetRule)
        if (tree) out.add(`street:${i}:${j}`, "street", { ...tree, x, y })
      })
  })
}

export function tileTrees(
  x: number,
  y: number,
  layers: Map<string, MvtLayer>,
  policy: TreePolicy,
): TileTrees {
  const frame = frameOf(x, y)
  const grid = occupancyOf(layers, frame, policy)
  const out = new Collector(frame)
  scatter(layers, frame, grid, policy, out)
  streets(layers, frame, grid, policy, out)
  const data = new Float64Array(out.trees.length * TILE_STRIDE)
  out.trees.forEach((tree, index) => {
    data.set(
      [tree.x / frame.scale, tree.y / frame.scale, tree.kind, tree.height, tree.tone, tree.spin],
      index * TILE_STRIDE,
    )
  })
  return { key: `${TILE_ZOOM}/${x}/${y}`, data, stats: out.stats }
}
