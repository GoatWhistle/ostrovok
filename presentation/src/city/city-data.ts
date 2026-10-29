import raw from "../data/city.json"

export type Flat = readonly number[]

export interface CityData {
  readonly origin: readonly [number, number]
  readonly buildings: readonly (readonly [number, string, string, Flat])[]
  readonly roads: readonly (readonly [string, Flat])[]
  readonly land: readonly Flat[]
  readonly cover: readonly (readonly [string, Flat])[]
  readonly water: readonly Flat[]
  readonly trees: Flat
  readonly hotels: readonly (readonly [string, string, number, number, number, string])[]
  readonly found: readonly string[]
  readonly route: Flat
  readonly facades: readonly Flat[]
  readonly noise: readonly (readonly [string, Flat])[]
  readonly landmarks: { readonly fisht: readonly [number, number]; readonly airport: readonly [number, number] }
}

export const CITY = raw as unknown as CityData

export const HERO_ID = "n7115085741"

export function insidePolygon(x: number, y: number, ring: Flat): boolean {
  let inside = false
  const count = ring.length / 2
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2] ?? 0
    const yi = ring[i * 2 + 1] ?? 0
    const xj = ring[j * 2] ?? 0
    const yj = ring[j * 2 + 1] ?? 0
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function polygonArea(ring: Flat): number {
  let area = 0
  const count = ring.length / 2
  for (let i = 0, j = count - 1; i < count; j = i++) {
    area += ((ring[j * 2] ?? 0) - (ring[i * 2] ?? 0)) * ((ring[j * 2 + 1] ?? 0) + (ring[i * 2 + 1] ?? 0))
  }
  return area / 2
}

export function centroid(ring: Flat): [number, number] {
  let x = 0
  let y = 0
  const count = ring.length / 2
  for (let i = 0; i < count; i++) {
    x += ring[i * 2] ?? 0
    y += ring[i * 2 + 1] ?? 0
  }
  return [x / count, y / count]
}

export function hotelBuildings(): Map<string, number> {
  const result = new Map<string, number>()
  const boxes = CITY.buildings.map(([, , , ring]) => {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i] ?? 0
      const y = ring[i + 1] ?? 0
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    return [minX, minY, maxX, maxY] as const
  })
  for (const [id, , x, y] of CITY.hotels) {
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY
    CITY.buildings.forEach(([, , , ring], index) => {
      const box = boxes[index]
      if (!box) return
      const dx = Math.max(box[0] - x, 0, x - box[2])
      const dy = Math.max(box[1] - y, 0, y - box[3])
      const distance = Math.hypot(dx, dy)
      if (distance > 25 || distance > bestDistance) return
      if (insidePolygon(x, y, ring)) {
        best = index
        bestDistance = -1
      } else if (bestDistance >= 0) {
        best = index
        bestDistance = distance
      }
    })
    if (best >= 0) result.set(id, best)
  }
  return result
}
