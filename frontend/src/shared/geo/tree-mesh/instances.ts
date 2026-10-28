export const INSTANCE_STRIDE = 6
export const CHUNK_M = 160
export const PICK_SPREAD = 4.7713
const KINDS = 3
const CROWN_M = 6

export interface TreeInstances {
  readonly origin: readonly [number, number]
  readonly kinds: readonly Float32Array[]
}

export interface TreeChunk {
  readonly box: Float32Array
  readonly starts: Int32Array
  readonly counts: Int32Array
}

export interface ChunkedTrees {
  readonly origin: readonly [number, number]
  readonly radius: number
  readonly kinds: readonly Float32Array[]
  readonly chunks: readonly TreeChunk[]
}

export function pickOf(spin: number): number {
  const value = spin * PICK_SPREAD
  return value - Math.floor(value)
}

function chunkKey(x: number, y: number): number {
  return (Math.floor(y / CHUNK_M) + 4096) * 8192 + Math.floor(x / CHUNK_M) + 4096
}

function newChunk(): TreeChunk {
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
  return { box, starts: new Int32Array(KINDS), counts: new Int32Array(KINDS) }
}

function grow(chunk: TreeChunk, data: Float32Array, at: number) {
  const { box } = chunk
  const x = data[at] ?? 0
  const y = data[at + 1] ?? 0
  const z = data[at + 2] ?? 0
  const top = z + (data[at + 3] ?? 0)
  box[0] = Math.min(box[0] ?? 0, x - CROWN_M)
  box[1] = Math.min(box[1] ?? 0, y - CROWN_M)
  box[2] = Math.min(box[2] ?? 0, z)
  box[3] = Math.max(box[3] ?? 0, x + CROWN_M)
  box[4] = Math.max(box[4] ?? 0, y + CROWN_M)
  box[5] = Math.max(box[5] ?? 0, top)
}

function sortKind(
  data: Float32Array,
  keys: Map<number, number>,
  chunks: TreeChunk[],
  kind: number,
) {
  const count = data.length / INSTANCE_STRIDE
  const order = Array.from({ length: count }, (_, index) => index)
  const slot = order.map((index) => {
    const at = index * INSTANCE_STRIDE
    return keys.get(chunkKey(data[at] ?? 0, data[at + 1] ?? 0)) ?? 0
  })
  const pick = order.map((index) => pickOf(data[index * INSTANCE_STRIDE + 5] ?? 0))
  order.sort((a, b) => (slot[a] ?? 0) - (slot[b] ?? 0) || (pick[a] ?? 0) - (pick[b] ?? 0))
  const sorted = new Float32Array(data.length)
  order.forEach((index, position) => {
    const at = index * INSTANCE_STRIDE
    sorted.set(data.subarray(at, at + INSTANCE_STRIDE), position * INSTANCE_STRIDE)
    const chunk = chunks[slot[index] ?? 0]
    if (!chunk) return
    if ((chunk.counts[kind] ?? 0) === 0) chunk.starts[kind] = position
    chunk.counts[kind] = (chunk.counts[kind] ?? 0) + 1
    grow(chunk, data, at)
  })
  return sorted
}

export function chunkTrees(instances: TreeInstances): ChunkedTrees {
  const keySet = new Set<number>()
  let radius = 0
  for (const data of instances.kinds)
    for (let at = 0; at < data.length; at += INSTANCE_STRIDE) {
      const x = data[at] ?? 0
      const y = data[at + 1] ?? 0
      keySet.add(chunkKey(x, y))
      radius = Math.max(radius, Math.hypot(x, y))
    }
  const ordered = [...keySet].sort((a, b) => a - b)
  const keys = new Map(ordered.map((key, index) => [key, index]))
  const chunks = ordered.map(newChunk)
  const kinds = instances.kinds.map((data, kind) => sortKind(data, keys, chunks, kind))
  return { origin: instances.origin, radius, kinds, chunks }
}
