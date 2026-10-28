import { seedOf } from "./plan"
import { type RoofWriter, STEEL_TONE } from "./writer"

type Ring = readonly (readonly [number, number])[]

const PARAPET = 0.8
const MIN_EDGE = 0.8
const HOUSING_AREA = 350
const MAX_HOUSINGS = 3

function signedArea(ring: Ring): number {
  let area = 0
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index] ?? [0, 0]
    const [x2, y2] = ring[(index + 1) % ring.length] ?? [0, 0]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

function inside([x, y]: readonly [number, number], ring: Ring): boolean {
  let hit = false
  for (let index = 0, prev = ring.length - 1; index < ring.length; prev = index, index += 1) {
    const [xi, yi] = ring[index] ?? [0, 0]
    const [xj, yj] = ring[prev] ?? [0, 0]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export function writeParapet(writer: RoofWriter, ring: Ring) {
  const outward = signedArea(ring) > 0 ? 1 : -1
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const [x1, y1] = ring[index] ?? [0, 0]
    const [x2, y2] = ring[index + 1] ?? [0, 0]
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < MIN_EDGE) continue
    writer.face(
      [
        [x1, y1, 0],
        [x2, y2, 0],
        [x2, y2, PARAPET],
        [x1, y1, PARAPET],
      ],
      writer.wall,
      [(outward * (y2 - y1)) / length, (outward * (x1 - x2)) / length, 0],
    )
  }
}

export interface FlatBox {
  readonly id: string
  readonly ring: Ring
  readonly halfLength: number
  readonly halfWidth: number
  readonly area: number
  readonly toLocal: (u: number, v: number) => readonly [number, number]
}

export function writeHousings(writer: RoofWriter, flat: FlatBox) {
  const count = Math.min(MAX_HOUSINGS, Math.floor(flat.area / HOUSING_AREA))
  let seed = seedOf(flat.id)
  for (let index = 0; index < count; index += 1) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0
    const u = ((seed % 1000) / 1000 - 0.5) * flat.halfLength
    const v = (((seed >>> 10) % 1000) / 1000 - 0.5) * flat.halfWidth
    const size = 2.2 + ((seed >>> 20) % 10) / 6
    const corner = flat.toLocal(u, v)
    if (!inside(corner, flat.ring)) continue
    writer.box(u, v, size, 0, 1.4 + (seed % 7) / 5, index === 0 ? writer.wall : STEEL_TONE)
  }
}
