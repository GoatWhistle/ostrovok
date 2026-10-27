import { buildWindowMesh, type WindowBuilding, type WindowMesh } from "./window-mesh"

interface WindowReply {
  readonly id: number
  readonly mesh: WindowMesh
}

export class WindowBuilder {
  private worker: Worker | null = null
  private latest = 0
  private resolve: ((mesh: WindowMesh | undefined) => void) | null = null

  build(buildings: readonly WindowBuilding[], origin: readonly [number, number]) {
    this.cancel()
    const id = this.latest
    if (typeof Worker === "undefined") return Promise.resolve(buildWindowMesh(buildings, origin))
    this.worker ??= this.start()
    return new Promise<WindowMesh | undefined>((resolve) => {
      this.resolve = resolve
      this.worker?.postMessage({ id, buildings, origin })
    })
  }

  cancel() {
    this.latest += 1
    this.resolve?.(undefined)
    this.resolve = null
  }

  dispose() {
    this.cancel()
    this.worker?.terminate()
    this.worker = null
    this.resolve = null
  }

  private start() {
    const worker = new Worker(new URL("./window-worker.ts", import.meta.url), { type: "module" })
    worker.addEventListener("message", (event: MessageEvent<WindowReply>) => {
      if (event.data.id === this.latest) {
        this.resolve?.(event.data.mesh)
        this.resolve = null
      }
    })
    return worker
  }
}
