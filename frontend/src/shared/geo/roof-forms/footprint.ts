export type Position = readonly [number, number]

export interface RoofFrame {
  readonly origin: Position
  readonly scale: Position
  readonly major: Position
  readonly minor: Position
  readonly center: Position
  readonly length: number
  readonly width: number
  readonly rectangularity: number
}

const METRES_PER_DEGREE = 111_320

function ringArea(points: readonly Position[]): number {
  let total = 0
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0]
    total += x1 * y2 - x2 * y1
  }
  return Math.abs(total) / 2
}

function principalAxis(points: readonly Position[]): Position {
  const count = points.length
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / count
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / count
  let xx = 0
  let yy = 0
  let xy = 0
  for (const [x, y] of points) {
    xx += (x - meanX) ** 2
    yy += (y - meanY) ** 2
    xy += (x - meanX) * (y - meanY)
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
  return [Math.cos(angle), Math.sin(angle)]
}

function extent(points: readonly Position[], axis: Position): [number, number] {
  const values = points.map(([x, y]) => x * axis[0] + y * axis[1])
  return [Math.min(...values), Math.max(...values)]
}

export function toLocal(ring: readonly Position[]): {
  points: Position[]
  origin: Position
  scale: Position
} {
  const origin = ring[0] ?? [0, 0]
  const scale: Position = [
    METRES_PER_DEGREE * Math.cos((origin[1] * Math.PI) / 180),
    METRES_PER_DEGREE,
  ]
  const closed = ring.length > 1 && ring[0]?.[0] === ring.at(-1)?.[0]
  const open = closed ? ring.slice(0, -1) : ring
  const points = open.map(
    ([lon, lat]): Position => [(lon - origin[0]) * scale[0], (lat - origin[1]) * scale[1]],
  )
  return { points, origin, scale }
}

export function roofFrame(ring: readonly Position[]): RoofFrame | undefined {
  const { points, origin, scale } = toLocal(ring)
  if (points.length < 4) return undefined
  const major = principalAxis(points)
  const minor: Position = [-major[1], major[0]]
  const [u0, u1] = extent(points, major)
  const [v0, v1] = extent(points, minor)
  const length = u1 - u0
  const width = v1 - v0
  if (length <= 0 || width <= 0) return undefined
  const u = (u0 + u1) / 2
  const v = (v0 + v1) / 2
  const center: Position = [u * major[0] + v * minor[0], u * major[1] + v * minor[1]]
  const ordered = length >= width
  return {
    origin,
    scale,
    major: ordered ? major : minor,
    minor: ordered ? minor : major,
    center,
    length: Math.max(length, width),
    width: Math.min(length, width),
    rectangularity: ringArea(points) / (length * width),
  }
}

export function insetRing(
  ring: readonly Position[],
  frame: RoofFrame,
  along: number,
  across: number,
): Position[] {
  const { points } = toLocal(ring)
  const shrunk = points.map(([x, y]): Position => {
    const dx = x - frame.center[0]
    const dy = y - frame.center[1]
    const u = (dx * frame.major[0] + dy * frame.major[1]) * along
    const v = (dx * frame.minor[0] + dy * frame.minor[1]) * across
    const px = frame.center[0] + u * frame.major[0] + v * frame.minor[0]
    const py = frame.center[1] + u * frame.major[1] + v * frame.minor[1]
    return [frame.origin[0] + px / frame.scale[0], frame.origin[1] + py / frame.scale[1]]
  })
  const first = shrunk[0]
  return first ? [...shrunk, first] : shrunk
}
