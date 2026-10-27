import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { WindowBuilder } from "@/shared/geo/night-city/window-builder"
import type { WindowMesh } from "@/shared/geo/night-city/window-mesh"

const workers: TestWorker[] = []

class TestWorker {
  listener: ((event: MessageEvent<{ id: number; mesh: WindowMesh }>) => void) | undefined
  messages: { id: number }[] = []
  terminated = false

  constructor() {
    workers.push(this)
  }

  addEventListener(
    _name: string,
    listener: (event: MessageEvent<{ id: number; mesh: WindowMesh }>) => void,
  ) {
    this.listener = listener
  }

  postMessage(message: { id: number }) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  reply(index: number, mesh: WindowMesh) {
    const message = this.messages[index]
    if (!message) throw new Error("Missing worker request")
    this.listener?.(new MessageEvent("message", { data: { id: message.id, mesh } }))
  }
}

const mesh: WindowMesh = {
  origin: [39.7, 43.5],
  vertices: new Float32Array(6),
  indices: new Uint32Array(3),
}

beforeEach(() => {
  workers.length = 0
  vi.stubGlobal("Worker", TestWorker)
})
afterEach(() => vi.unstubAllGlobals())

it("settles replaced work and ignores its late response", async () => {
  const builder = new WindowBuilder()
  const first = builder.build([], mesh.origin)
  const second = builder.build([], mesh.origin)
  await expect(first).resolves.toBeUndefined()
  const worker = workers[0]
  worker?.reply(0, mesh)
  const settled = vi.fn()
  void second.then(settled)
  await Promise.resolve()
  expect(settled).not.toHaveBeenCalled()
  worker?.reply(1, mesh)
  await expect(second).resolves.toBe(mesh)
  builder.dispose()
})

it("cancels pending work and terminates its worker on disposal", async () => {
  const builder = new WindowBuilder()
  const pending = builder.build([], mesh.origin)
  const worker = workers[0]
  builder.dispose()
  await expect(pending).resolves.toBeUndefined()
  expect(worker?.terminated).toBe(true)
  worker?.reply(0, mesh)
  const next = builder.build([], mesh.origin)
  expect(workers).toHaveLength(2)
  workers[1]?.reply(0, mesh)
  await expect(next).resolves.toBe(mesh)
  builder.dispose()
})
