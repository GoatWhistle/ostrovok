import { type Map as MapLibreMap, MercatorCoordinate } from "maplibre-gl"
import { type FieldRequest, tilesAround } from "./field"
import type { ChunkedTrees } from "./instances"
import type { WorkerRequest } from "./trees.worker"

const TILE_URL = "/api/v1/map/tiles/{z}/{x}/{y}.pbf?v=lod-v3"
const ELEVATION_CELLS = 2 ** 21
const SLICE_MS = 4

type Reply =
  | { readonly type: "field"; readonly id: number; readonly positions: Float64Array }
  | { readonly type: "chunks"; readonly id: number; readonly chunked: ChunkedTrees }

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export class TreeClient {
  private readonly worker = new Worker(new URL("./trees.worker.ts", import.meta.url), {
    type: "module",
  })
  private readonly waiting = new Map<string, (reply: Reply) => void>()
  private readonly ground = new Map<string, number>()
  private sequence = 0

  private readonly map: MapLibreMap

  constructor(map: MapLibreMap) {
    this.map = map
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      const key = `${event.data.type}:${event.data.id}`
      this.waiting.get(key)?.(event.data)
      this.waiting.delete(key)
    }
  }

  private send(
    message: WorkerRequest,
    expect: Reply["type"],
    id: number,
    transfer: Transferable[] = [],
  ) {
    return new Promise<Reply>((resolve) => {
      for (const key of this.waiting.keys())
        if (key.startsWith(`${expect}:`)) this.waiting.delete(key)
      this.waiting.set(`${expect}:${id}`, resolve)
      this.worker.postMessage(message, transfer)
    })
  }

  forgetGround() {
    this.ground.clear()
  }

  async build(radius: number): Promise<ChunkedTrees | undefined> {
    const id = ++this.sequence
    const center = this.map.getCenter()
    const point = MercatorCoordinate.fromLngLat(center, 0)
    const metres = 1 / point.meterInMercatorCoordinateUnits()
    const request: FieldRequest = {
      id,
      tiles: tilesAround([point.x, point.y], radius, metres),
      center: [point.x, point.y],
      origin: [center.lng, center.lat],
      metres,
      radius,
    }
    const url = `${window.location.origin}${TILE_URL}`
    const field = await this.send({ type: "field", request, url }, "field", id)
    if (field.type !== "field" || id !== this.sequence) return undefined
    const ground = await this.elevations(field.positions, id)
    if (!ground) return undefined
    const terrain = this.map.getTerrain() !== null
    const packed = await this.send({ type: "pack", id, ground, terrain }, "chunks", id, [
      ground.buffer,
    ])
    return packed.type === "chunks" && id === this.sequence ? packed.chunked : undefined
  }

  private async elevations(positions: Float64Array, id: number) {
    const count = positions.length / 2
    const out = new Float32Array(count)
    const terrain = this.map.getTerrain() !== null
    let started = performance.now()
    for (let index = 0; index < count; index += 1) {
      if (!terrain) break
      if (performance.now() - started > SLICE_MS) {
        await nextTask()
        if (id !== this.sequence) return undefined
        started = performance.now()
      }
      out[index] = this.elevation(positions[index * 2] ?? 0, positions[index * 2 + 1] ?? 0)
    }
    return out
  }

  private elevation(x: number, y: number): number {
    const key = `${Math.round(x * ELEVATION_CELLS)}:${Math.round(y * ELEVATION_CELLS)}`
    const cached = this.ground.get(key)
    if (cached !== undefined) return cached
    const value = this.map.queryTerrainElevation(new MercatorCoordinate(x, y, 0).toLngLat())
    if (value === null) return 0
    this.ground.set(key, value)
    return value
  }

  dispose() {
    this.sequence += 1
    this.worker.terminate()
    this.waiting.clear()
  }
}
