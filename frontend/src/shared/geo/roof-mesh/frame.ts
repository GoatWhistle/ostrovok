export type Local = readonly [number, number]

export interface LocalFrame {
  readonly center: Local
  readonly major: Local
  readonly minor: Local
  readonly length: number
  readonly width: number
  readonly area: number
  readonly rectangularity: number
}

function ringArea(points: readonly Local[]): number {
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0]
    total += x1 * y2 - x2 * y1
  }
  return Math.abs(total) / 2
}

function open(ring: readonly Local[]): readonly Local[] {
  const first = ring[0]
  const last = ring.at(-1)
  return first && last && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring
}

function axisOf(points: readonly Local[]): Local {
  let best: Local = [1, 0]
  let smallest = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0]
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < 0.5) continue
    const axis: Local = [(x2 - x1) / length, (y2 - y1) / length]
    const [u0, u1] = span(points, axis)
    const [v0, v1] = span(points, [-axis[1], axis[0]])
    const area = (u1 - u0) * (v1 - v0)
    if (area < smallest) {
      smallest = area
      best = axis
    }
  }
  return best
}

function span(points: readonly Local[], [ax, ay]: Local): [number, number] {
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (const [x, y] of points) {
    const value = x * ax + y * ay
    low = Math.min(low, value)
    high = Math.max(high, value)
  }
  return [low, high]
}

export function localFrame(
  closed: readonly Local[],
  extra: readonly Local[] = [],
): LocalFrame | undefined {
  const ring = open(closed)
  if (ring.length < 3) return undefined
  const axis = axisOf(ring)
  const cross: Local = [-axis[1], axis[0]]
  const all = extra.length > 0 ? [...ring, ...extra] : ring
  const [u0, u1] = span(all, axis)
  const [v0, v1] = span(all, cross)
  const along = u1 - u0
  const across = v1 - v0
  if (along <= 0 || across <= 0) return undefined
  const u = (u0 + u1) / 2
  const v = (v0 + v1) / 2
  const center: Local = [u * axis[0] + v * cross[0], u * axis[1] + v * cross[1]]
  const ordered = along >= across
  const area = ringArea(ring)
  const own = span(ring, axis)
  const ownCross = span(ring, cross)
  return {
    center,
    major: ordered ? axis : cross,
    minor: ordered ? cross : axis,
    length: Math.max(along, across),
    width: Math.min(along, across),
    area,
    rectangularity: area / ((own[1] - own[0]) * (ownCross[1] - ownCross[0])),
  }
}
