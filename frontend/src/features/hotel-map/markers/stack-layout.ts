export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

export function stackGroups(points: readonly ScreenPoint[], distance = 8): number[][] {
  const groups: number[][] = []
  points.forEach((point, index) => {
    const group = groups.find((items) => {
      const first = points[items[0] ?? -1]
      return first && Math.hypot(first.x - point.x, first.y - point.y) < distance
    })
    if (group) group.push(index)
    else groups.push([index])
  })
  return groups
}

export function spiderOffsets(count: number): [number, number][] {
  const radius = Math.max(52, count * 12)
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })
}
