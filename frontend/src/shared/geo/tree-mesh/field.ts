import { type ChunkedTrees, chunkTrees } from "./instances"
import { TILE_STRIDE, TILE_ZOOM, type TileTrees } from "./tile-trees"

export const MAX_TREES = 24000
const SEA_LEVEL = 0.4

export interface FieldRequest {
  readonly id: number
  readonly tiles: readonly (readonly [number, number])[]
  readonly center: readonly [number, number]
  readonly origin: readonly [number, number]
  readonly metres: number
  readonly radius: number
}

export function tilesAround(center: readonly [number, number], radius: number, metres: number) {
  const n = 2 ** TILE_ZOOM
  const reach = radius / metres
  const tiles: [number, number][] = []
  const [mx, my] = center
  for (let x = Math.floor((mx - reach) * n); x <= Math.floor((mx + reach) * n); x += 1)
    for (let y = Math.floor((my - reach) * n); y <= Math.floor((my + reach) * n); y += 1)
      tiles.push([x, y])
  return tiles
}

export function assemble(tiles: readonly TileTrees[], request: FieldRequest): Float64Array {
  const [cx, cy] = request.center
  const limit = request.radius / request.metres
  const found: { data: Float64Array; at: number; distance: number }[] = []
  for (const tile of tiles)
    for (let at = 0; at < tile.data.length; at += TILE_STRIDE) {
      const distance = Math.hypot((tile.data[at] ?? 0) - cx, (tile.data[at + 1] ?? 0) - cy)
      if (distance <= limit) found.push({ data: tile.data, at, distance })
    }
  found.sort((a, b) => a.distance - b.distance)
  const kept = found.slice(0, MAX_TREES)
  const out = new Float64Array(kept.length * TILE_STRIDE)
  kept.forEach(({ data, at }, index) => {
    out.set(data.subarray(at, at + TILE_STRIDE), index * TILE_STRIDE)
  })
  return out
}

export function packField(
  field: Float64Array,
  ground: Float32Array,
  request: FieldRequest,
  terrain: boolean,
): ChunkedTrees {
  const [cx, cy] = request.center
  const rows: number[][] = [[], [], []]
  for (let index = 0; index * TILE_STRIDE < field.length; index += 1) {
    const at = index * TILE_STRIDE
    const z = ground[index] ?? 0
    if (terrain && z <= SEA_LEVEL) continue
    rows[field[at + 2] ?? 0]?.push(
      ((field[at] ?? 0) - cx) * request.metres,
      ((field[at + 1] ?? 0) - cy) * request.metres,
      z,
      field[at + 3] ?? 0,
      field[at + 4] ?? 0,
      field[at + 5] ?? 0,
    )
  }
  const kinds = rows.map((row) => new Float32Array(row))
  return chunkTrees({ origin: request.origin, kinds })
}
