import { fetchWithRetry } from "@/shared/api/tile-retry"
import { assemble, type FieldRequest, packField } from "./field"
import { decodeTile } from "./mvt"
import { TREE_POLICY } from "./policy"
import { TILE_ZOOM, type TileTrees, tileTrees } from "./tile-trees"

export type WorkerRequest =
  | { readonly type: "field"; readonly request: FieldRequest; readonly url: string }
  | {
      readonly type: "pack"
      readonly id: number
      readonly ground: Float32Array
      readonly terrain: boolean
    }

interface Scope {
  postMessage(message: unknown, transfer: Transferable[]): void
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
}

const scope = self as unknown as Scope
const CACHE_TILES = 96
const cache = new Map<string, Promise<TileTrees>>()
let pending: { request: FieldRequest; field: Float64Array } | undefined

async function loadTile(url: string, x: number, y: number): Promise<TileTrees> {
  const address = url
    .replace("{z}", String(TILE_ZOOM))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
  const data = await fetchWithRetry(address, new AbortController().signal)
  return tileTrees(x, y, decodeTile(data), TREE_POLICY)
}

function tile(url: string, x: number, y: number): Promise<TileTrees> {
  const key = `${x}/${y}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const loading = loadTile(url, x, y)
  loading.catch(() => cache.delete(key))
  cache.set(key, loading)
  while (cache.size > CACHE_TILES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  return loading
}

async function field(request: FieldRequest, url: string) {
  const tiles = await Promise.all(
    request.tiles.map(([x, y]) => tile(url, x, y).catch(() => undefined)),
  )
  const found = assemble(
    tiles.filter((entry): entry is TileTrees => entry !== undefined),
    request,
  )
  pending = { request, field: found }
  const positions = new Float64Array(found.length / 3)
  for (let index = 0; index * 2 < positions.length; index += 1) {
    positions[index * 2] = found[index * 6] ?? 0
    positions[index * 2 + 1] = found[index * 6 + 1] ?? 0
  }
  scope.postMessage({ type: "field", id: request.id, positions }, [positions.buffer])
}

function pack(id: number, ground: Float32Array, terrain: boolean) {
  if (!pending || pending.request.id !== id) return
  const chunked = packField(pending.field, ground, pending.request, terrain)
  const transfer = [...chunked.kinds.map((data) => data.buffer as ArrayBuffer)]
  scope.postMessage({ type: "chunks", id, chunked }, transfer)
}

scope.onmessage = (event) => {
  const message = event.data
  if (message.type === "field") void field(message.request, message.url)
  else pack(message.id, message.ground, message.terrain)
}
