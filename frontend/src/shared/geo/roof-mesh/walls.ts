import { triangulate } from "./triangulate"
import type { RoofWriter } from "./writer"

type Ring = readonly (readonly [number, number])[]

const SINK = 3
const MIN_EDGE = 0.3

function signedArea(ring: Ring): number {
  let area = 0
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index] ?? [0, 0]
    const [x2, y2] = ring[(index + 1) % ring.length] ?? [0, 0]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

export function writeWalls(writer: RoofWriter, ring: Ring, height: number) {
  const outward = signedArea(ring) > 0 ? 1 : -1
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const [x1, y1] = ring[index] ?? [0, 0]
    const [x2, y2] = ring[index + 1] ?? [0, 0]
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < MIN_EDGE) continue
    writer.face(
      [
        [x1, y1, -SINK],
        [x2, y2, -SINK],
        [x2, y2, height],
        [x1, y1, height],
      ],
      writer.wall,
      [(outward * (y2 - y1)) / length, (outward * (x1 - x2)) / length, 0],
    )
  }
}

export function writeCap(writer: RoofWriter, ring: Ring, height: number, tone: number): boolean {
  const triangles = triangulate(ring)
  if (triangles.length === 0) return false
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    const corners = [triangles[index], triangles[index + 1], triangles[index + 2]].map((at) => {
      const [x, y] = ring[at ?? 0] ?? [0, 0]
      return [x, y, height] as const
    })
    writer.face(corners, tone, [0, 0, 1])
  }
  return true
}
