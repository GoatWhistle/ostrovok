type Local = readonly [number, number]

function cross(a: Local, b: Local, c: Local): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function contains(a: Local, b: Local, c: Local, p: Local): boolean {
  return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0
}

function isEar(points: readonly Local[], order: readonly number[], at: number): boolean {
  const count = order.length
  const a = points[order[(at + count - 1) % count] ?? 0] ?? [0, 0]
  const b = points[order[at] ?? 0] ?? [0, 0]
  const c = points[order[(at + 1) % count] ?? 0] ?? [0, 0]
  if (cross(a, b, c) <= 0) return false
  for (const index of order) {
    const p = points[index] ?? [0, 0]
    if (p === a || p === b || p === c) continue
    if (contains(a, b, c, p)) return false
  }
  return true
}

function openRing(ring: readonly Local[]): readonly Local[] {
  const last = ring.at(-1)
  const first = ring[0]
  return first && last && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring
}

function windingOrder(points: readonly Local[]): number[] {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0]
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0]
    area += x1 * y2 - x2 * y1
  }
  const order = points.map((_, index) => index)
  return area < 0 ? order.reverse() : order
}

function clipEar(points: readonly Local[], order: number[], triangles: number[]): boolean {
  const count = order.length
  for (let at = 0; at < count; at += 1) {
    if (!isEar(points, order, at)) continue
    triangles.push(
      order[(at + count - 1) % count] ?? 0,
      order[at] ?? 0,
      order[(at + 1) % count] ?? 0,
    )
    order.splice(at, 1)
    return true
  }
  return false
}

export function triangulate(ring: readonly Local[]): number[] {
  const points = openRing(ring)
  const order = windingOrder(points)
  const triangles: number[] = []
  while (order.length > 3) if (!clipEar(points, order, triangles)) return []
  if (order.length === 3) triangles.push(order[0] ?? 0, order[1] ?? 0, order[2] ?? 0)
  return triangles
}
