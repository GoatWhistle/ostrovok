export interface Shot {
  readonly x: number
  readonly y: number
  readonly distance: number
  readonly pitch: number
  readonly bearing: number
}

export interface CameraPath {
  readonly shots: readonly Shot[]
  readonly seconds: number
  readonly loop: boolean
  readonly drift?: boolean
}

type Vector = [number, number, number, number, number]

function unwrap(shots: readonly Shot[]): Vector[] {
  let previous = shots[0]?.bearing ?? 0
  return shots.map((shot) => {
    let bearing = shot.bearing
    while (bearing - previous > 180) bearing -= 360
    while (bearing - previous < -180) bearing += 360
    previous = bearing
    return [shot.x, shot.y, Math.log(shot.distance), shot.pitch, bearing]
  })
}

function spline(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export function ease(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function pick(points: readonly Vector[], index: number, loop: boolean): Vector {
  const count = points.length
  const wrapped = loop ? ((index % count) + count) % count : Math.min(count - 1, Math.max(0, index))
  return points[wrapped] ?? points[0] ?? [0, 0, 0, 0, 0]
}

function toShot(value: readonly number[]): Shot {
  return {
    x: value[0] ?? 0,
    y: value[1] ?? 0,
    distance: Math.exp(value[2] ?? 0),
    pitch: value[3] ?? 0,
    bearing: value[4] ?? 0,
  }
}

export function shotAt(path: CameraPath, elapsed: number): Shot {
  if (path.drift) {
    const [start, end] = path.shots
    if (start && end) {
      const t = Math.min(1, Math.max(0, elapsed / path.seconds))
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        distance: start.distance + (end.distance - start.distance) * t,
        pitch: start.pitch + (end.pitch - start.pitch) * t,
        bearing: start.bearing + (end.bearing - start.bearing) * t,
      }
    }
  }
  const points = unwrap(path.shots)
  const segments = path.loop ? points.length : points.length - 1
  if (segments <= 0) return path.shots[0] ?? { x: 0, y: 0, distance: 600, pitch: 50, bearing: 0 }
  const raw = elapsed / path.seconds
  const progress = path.loop ? raw - Math.floor(raw) : Math.min(1, Math.max(0, raw))
  const position = progress * segments
  const index = Math.min(segments - 1, Math.floor(position))
  const local = position - index
  const a = pick(points, index - 1, path.loop)
  const b = pick(points, index, path.loop)
  const c = pick(points, index + 1, path.loop)
  const d = pick(points, index + 2, path.loop)
  return toShot(b.map((_, axis) => spline(a[axis] ?? 0, b[axis] ?? 0, c[axis] ?? 0, d[axis] ?? 0, local)))
}

export function blendShots(from: Shot, to: Shot, value: number): Shot {
  const t = ease(value)
  let bearing = to.bearing
  while (bearing - from.bearing > 180) bearing -= 360
  while (bearing - from.bearing < -180) bearing += 360
  const travel = Math.hypot(to.x - from.x, to.y - from.y)
  const lift = Math.sin(Math.PI * t) * Math.min(travel * 0.6, 2400)
  const logDistance = Math.log(from.distance) + (Math.log(to.distance) - Math.log(from.distance)) * t
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    distance: Math.exp(logDistance) + lift,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    bearing: from.bearing + (bearing - from.bearing) * t,
  }
}

export function orbit(
  center: readonly [number, number],
  radius: number,
  view: { readonly distance: number; readonly pitch: number; readonly start: number; readonly turn?: number },
  steps: number,
): Shot[] {
  const turn = view.turn ?? 360
  return Array.from({ length: steps }, (_, step) => {
    const angle = view.start + (step / steps) * turn
    const radians = (angle * Math.PI) / 180
    return {
      x: center[0] + Math.sin(radians) * radius,
      y: center[1] + Math.cos(radians) * radius,
      distance: view.distance,
      pitch: view.pitch,
      bearing: angle + 180,
    }
  })
}
