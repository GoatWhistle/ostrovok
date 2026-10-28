export type Position = readonly [number, number]

const METRES_PER_DEGREE = 111_320

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
