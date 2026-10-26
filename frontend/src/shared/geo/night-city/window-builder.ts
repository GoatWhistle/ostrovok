import { buildWindowMesh, type WindowBuilding, type WindowMesh } from "./window-mesh"

interface WindowReply {
  readonly id: number
  readonly mesh: WindowMesh
}

export class WindowBuilder {
  private worker: Worker | null = null
  private latest = 0
  private resolve: ((mesh: WindowMesh) => void) | null = null

  build(buildings: readonly WindowBuilding[], origin: readonly [number, number]) {
    this.latest += 1
    const id = this.latest
    if (typeof Worker === "undefined") return Promise.resolve(buildWindowMesh(buildings, origin))
    this.worker ??= this.start()
    return new Promise<WindowMesh>((resolve) => {
      this.resolve = resolve
      this.worker?.postMessage({ id, buildings, origin })
    })
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.resolve = null
  }

  private start() {
    const worker = new Worker(new URL("./window-worker.ts", import.meta.url), { type: "module" })
    worker.addEventListener("message", (event: MessageEvent<WindowReply>) => {
      if (event.data.id === this.latest) this.resolve?.(event.data.mesh)
    })
    return worker
  }
}
