import { type ChunkedTrees, INSTANCE_STRIDE, pickOf, type TreeChunk } from "./instances"

export const MIN_KEEP = 0.18
const KEEP_STEPS = 24
const KINDS = 3

export interface TreeView {
  readonly matrix: Float32Array
  readonly camera: readonly [number, number, number]
  readonly nearDistance: number
  readonly thinDistance: number
}

function row(m: Float32Array, at: number, x: number, y: number, z: number): number {
  return (m[at] ?? 0) * x + (m[4 + at] ?? 0) * y + (m[8 + at] ?? 0) * z + (m[12 + at] ?? 0)
}

function clipMask(m: Float32Array, x: number, y: number, z: number): number {
  const cx = row(m, 0, x, y, z)
  const cy = row(m, 1, x, y, z)
  const cw = row(m, 3, x, y, z)
  return (
    (cx < -cw ? 1 : 0) |
    (cx > cw ? 2 : 0) |
    (cy < -cw ? 4 : 0) |
    (cy > cw ? 8 : 0) |
    (cw <= 0 ? 16 : 0)
  )
}

function outside(matrix: Float32Array, box: Float32Array): boolean {
  let all = 31
  for (let corner = 0; corner < 8; corner += 1)
    all &= clipMask(
      matrix,
      box[corner & 1 ? 3 : 0] ?? 0,
      box[corner & 2 ? 4 : 1] ?? 0,
      box[corner & 4 ? 5 : 2] ?? 0,
    )
  return all !== 0
}

function nearest(box: Float32Array, [x, y, z]: readonly [number, number, number]): number {
  const dx = Math.max((box[0] ?? 0) - x, 0, x - (box[3] ?? 0))
  const dy = Math.max((box[1] ?? 0) - y, 0, y - (box[4] ?? 0))
  const dz = Math.max((box[2] ?? 0) - z, 0, z - (box[5] ?? 0))
  return Math.max(1, Math.hypot(dx, dy, dz))
}

function chunkState(chunk: TreeChunk, view: TreeView): number {
  if (outside(view.matrix, chunk.box)) return 0
  const distance = nearest(chunk.box, view.camera)
  if (distance < view.nearDistance) return 1
  const keep = Math.min(1, Math.max(MIN_KEEP, view.thinDistance / distance))
  return 2 + Math.ceil(keep * KEEP_STEPS)
}

function prefix(data: Float32Array, start: number, count: number, keep: number): number {
  let low = 0
  let high = count
  while (low < high) {
    const middle = (low + high) >> 1
    if (pickOf(data[(start + middle) * INSTANCE_STRIDE + 5] ?? 0) < keep) low = middle + 1
    else high = middle
  }
  return low
}

export class TreeSelection {
  readonly near: Float32Array[] = []
  readonly far: Float32Array[] = []
  readonly nearCount = new Int32Array(KINDS)
  readonly farCount = new Int32Array(KINDS)
  private states = new Uint8Array(0)
  private trees: ChunkedTrees | undefined

  reset(trees: ChunkedTrees) {
    this.trees = trees
    this.states = new Uint8Array(trees.chunks.length).fill(255)
    this.near.length = 0
    this.far.length = 0
    for (const data of trees.kinds) {
      this.near.push(new Float32Array(data.length))
      this.far.push(new Float32Array(data.length))
    }
  }

  update(view: TreeView): boolean {
    const trees = this.trees
    if (!trees) return false
    let changed = false
    trees.chunks.forEach((chunk, index) => {
      const state = chunkState(chunk, view)
      if (state !== this.states[index]) changed = true
      this.states[index] = state
    })
    if (changed) this.fill(trees)
    return changed
  }

  private fill(trees: ChunkedTrees) {
    this.nearCount.fill(0)
    this.farCount.fill(0)
    trees.chunks.forEach((chunk, index) => {
      const state = this.states[index] ?? 0
      if (state === 0) return
      for (let kind = 0; kind < KINDS; kind += 1) this.copy(trees, chunk, kind, state)
    })
  }

  private copy(trees: ChunkedTrees, chunk: TreeChunk, kind: number, state: number) {
    const data = trees.kinds[kind]
    const start = chunk.starts[kind] ?? 0
    const total = chunk.counts[kind] ?? 0
    if (!data || total === 0) return
    const near = state === 1
    const count = near ? total : prefix(data, start, total, (state - 2) / KEEP_STEPS)
    const target = near ? this.near[kind] : this.far[kind]
    const counts = near ? this.nearCount : this.farCount
    const offset = counts[kind] ?? 0
    target?.set(
      data.subarray(start * INSTANCE_STRIDE, (start + count) * INSTANCE_STRIDE),
      offset * INSTANCE_STRIDE,
    )
    counts[kind] = offset + count
  }
}
