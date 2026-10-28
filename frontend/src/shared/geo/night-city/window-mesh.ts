export interface WindowBuilding {
  readonly id: string
  readonly rings: readonly (readonly (readonly [number, number])[])[]
  readonly ground: number
  readonly base: number
  readonly height: number
}

export interface WindowMesh {
  readonly origin: readonly [number, number]
  readonly vertices: Float32Array
  readonly indices: Uint32Array
}

export const WINDOW_STRIDE = 6
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6371008.8
const WALL_OFFSET_M = 0.15
const MIN_SEGMENT_M = 0.25
const MIN_RING_M = 8
const MIN_HEIGHT_M = 3
const SHOPFRONT_FROM_M = 12

function mercator(lon: number, lat: number): readonly [number, number] {
  const sin = Math.sin((lat * Math.PI) / 180)
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)]
}

export function seedOf(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function signedArea(points: readonly (readonly [number, number])[]): number {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

interface Frame {
  readonly ox: number
  readonly oy: number
  readonly metres: number
}

interface Wall {
  readonly from: readonly [number, number]
  readonly to: readonly [number, number]
  readonly along: number
  readonly outward: number
}

function project(ring: readonly (readonly [number, number])[], frame: Frame) {
  return ring.map(([lon, lat]) => {
    const [x, y] = mercator(lon, lat)
    return [(x - frame.ox) * frame.metres, (y - frame.oy) * frame.metres] as const
  })
}

function pushWall(
  wall: Wall,
  building: WindowBuilding,
  seed: number,
  vertices: number[],
  indices: number[],
) {
  const [x1, y1] = wall.from
  const [x2, y2] = wall.to
  const length = Math.hypot(x2 - x1, y2 - y1)
  const nx = (wall.outward * (y2 - y1) * WALL_OFFSET_M) / length
  const ny = (wall.outward * (x1 - x2) * WALL_OFFSET_M) / length
  const first = vertices.length / WINDOW_STRIDE
  const bottom = building.ground + building.base
  const top = building.ground + building.height
  for (const [x, y, u] of [
    [x1, y1, wall.along],
    [x2, y2, wall.along + length],
  ] as const) {
    vertices.push(x + nx, y + ny, bottom, u, building.base, seed)
    vertices.push(x + nx, y + ny, top, u, building.height, seed)
  }
  indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3)
}

function pushRing(
  points: readonly (readonly [number, number])[],
  building: WindowBuilding,
  seed: number,
  vertices: number[],
  indices: number[],
) {
  const outward = signedArea(points) > 0 ? 1 : -1
  let perimeter = 0
  for (let index = 0; index + 1 < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[index + 1] ?? [0, 0]
    perimeter += Math.hypot(x2 - x1, y2 - y1)
  }
  if (perimeter < MIN_RING_M) return
  let along = 0
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index] ?? [0, 0]
    const to = points[index + 1] ?? [0, 0]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    if (length >= MIN_SEGMENT_M)
      pushWall({ from, to, along, outward }, building, seed, vertices, indices)
    along += length
  }
}

export function buildWindowMesh(
  buildings: readonly WindowBuilding[],
  origin: readonly [number, number],
): WindowMesh {
  const [ox, oy] = mercator(origin[0], origin[1])
  const frame = { ox, oy, metres: EARTH_CIRCUMFERENCE_M * Math.cos((origin[1] * Math.PI) / 180) }
  const vertices: number[] = []
  const indices: number[] = []
  for (const building of buildings) {
    if (building.height - building.base < MIN_HEIGHT_M) continue
    const seed = seedOf(building.id) + (building.height >= SHOPFRONT_FROM_M ? 1 : 0)
    for (const ring of building.rings)
      pushRing(project(ring, frame), building, seed, vertices, indices)
  }
  return { origin, vertices: new Float32Array(vertices), indices: new Uint32Array(indices) }
}
