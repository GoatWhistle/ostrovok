import { buildWindowMesh, type WindowBuilding } from "./window-mesh"

interface WindowRequest {
  readonly id: number
  readonly buildings: readonly WindowBuilding[]
  readonly origin: readonly [number, number]
}

addEventListener("message", (event: MessageEvent<WindowRequest>) => {
  const mesh = buildWindowMesh(event.data.buildings, event.data.origin)
  postMessage(
    { id: event.data.id, mesh },
    { transfer: [mesh.vertices.buffer, mesh.indices.buffer] },
  )
})
