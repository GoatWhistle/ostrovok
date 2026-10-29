import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from "three"
import { CITY, type Flat, polygonArea } from "./city-data"
import { FLAT_ROOFS, hash, pick, ROOFS, token, WALLS } from "./palette"

const PITCHED = new Set(["house", "residence", "garage", "shed", "detached", "roof"])

class Builder {
  positions: number[] = []
  normals: number[] = []
  colors: number[] = []
  walls: number[] = []

  push(
    x: number,
    y: number,
    z: number,
    normal: readonly [number, number, number],
    color: readonly [number, number, number],
    wall: readonly [number, number, number, number],
  ) {
    this.positions.push(x, y, z)
    this.normals.push(...normal)
    this.colors.push(...color)
    this.walls.push(...wall)
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3))
    geometry.setAttribute("aWall", new Float32BufferAttribute(this.walls, 4))
    geometry.computeBoundingSphere()
    return geometry
  }
}

function ring(flat: Flat): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) points.push([flat[i] ?? 0, -(flat[i + 1] ?? 0)])
  if (polygonArea(flat) < 0) points.reverse()
  return points
}

function triangleNormal(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
): [number, number, number] {
  const ux = (b[0] ?? 0) - (a[0] ?? 0)
  const uy = (b[1] ?? 0) - (a[1] ?? 0)
  const uz = (b[2] ?? 0) - (a[2] ?? 0)
  const vx = (c[0] ?? 0) - (a[0] ?? 0)
  const vy = (c[1] ?? 0) - (a[1] ?? 0)
  const vz = (c[2] ?? 0) - (a[2] ?? 0)
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz) || 1
  return [nx / length, ny / length, nz / length]
}

export interface BuildingRecord {
  readonly index: number
  readonly start: number
  readonly count: number
  readonly height: number
  readonly center: readonly [number, number]
}

function addBuilding(
  builder: Builder,
  points: [number, number][],
  height: number,
  kind: string,
  seed: number,
  hotel: boolean,
) {
  const area = Math.abs(polygonArea(points.flat()))
  const wallColor = hotel ? token("--map-toy-hotel-wall") : pick(WALLS, seed)
  const wall: [number, number, number] = [wallColor.r, wallColor.g, wallColor.b]
  const pitched = PITCHED.has(kind) && area < 420 && height <= 13 && points.length <= 8
  const roofColor = pitched ? pick(ROOFS, seed + 3) : pick(FLAT_ROOFS, seed + 7)
  const roof: [number, number, number] = [roofColor.r, roofColor.g, roofColor.b]
  let perimeter = 0
  const base = -1
  for (let i = 0; i < points.length; i++) {
    const a = points[i] ?? [0, 0]
    const b = points[(i + 1) % points.length] ?? [0, 0]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length < 0.01) continue
    const normal: [number, number, number] = [(b[1] - a[1]) / length, 0, -(b[0] - a[0]) / length]
    const u0 = perimeter
    const u1 = perimeter + length
    perimeter = u1
    const meta = (u: number, v: number): [number, number, number, number] => [u, v, seed, height]
    builder.push(a[0], base, a[1], normal, wall, meta(u0, base))
    builder.push(b[0], base, b[1], normal, wall, meta(u1, base))
    builder.push(b[0], height, b[1], normal, wall, meta(u1, height))
    builder.push(a[0], base, a[1], normal, wall, meta(u0, base))
    builder.push(b[0], height, b[1], normal, wall, meta(u1, height))
    builder.push(a[0], height, a[1], normal, wall, meta(u0, height))
  }
  const roofMeta: [number, number, number, number] = [0, -10, seed, 0]
  if (pitched) {
    let cx = 0
    let cz = 0
    for (const [x, z] of points) {
      cx += x
      cz += z
    }
    cx /= points.length
    cz /= points.length
    const rise = Math.min(4.2, Math.max(1.6, Math.sqrt(area) * 0.32))
    const apex = [cx, height + rise, cz]
    for (let i = 0; i < points.length; i++) {
      const a = points[i] ?? [0, 0]
      const b = points[(i + 1) % points.length] ?? [0, 0]
      const pa = [a[0], height, a[1]]
      const pb = [b[0], height, b[1]]
      const normal = triangleNormal(pa, apex, pb)
      const shade = 0.9 + hash(seed + i) * 0.14
      const tone: [number, number, number] = [roof[0] * shade, roof[1] * shade, roof[2] * shade]
      builder.push(pa[0] ?? 0, height, pa[2] ?? 0, normal, tone, roofMeta)
      builder.push(apex[0] ?? 0, apex[1] ?? 0, apex[2] ?? 0, normal, tone, roofMeta)
      builder.push(pb[0] ?? 0, height, pb[2] ?? 0, normal, tone, roofMeta)
    }
    return
  }
  const contour = points.map(([x, z]) => new Vector2(x, z))
  const triangles = ShapeUtils.triangulateShape(contour, [])
  for (const [i, j, k] of triangles) {
    for (const index of [i, k, j]) {
      const point = points[index ?? 0] ?? [0, 0]
      builder.push(point[0], height, point[1], [0, 1, 0], roof, roofMeta)
    }
  }
}

export function buildBuildings(hotelIndexes: ReadonlySet<number>) {
  const builder = new Builder()
  const records: BuildingRecord[] = []
  CITY.buildings.forEach(([height, kind, , flat], index) => {
    const points = ring(flat)
    if (points.length < 3) return
    const start = builder.positions.length / 3
    addBuilding(builder, points, Math.max(3, height), kind, index + 1, hotelIndexes.has(index))
    let cx = 0
    let cy = 0
    for (let i = 0; i < flat.length; i += 2) {
      cx += flat[i] ?? 0
      cy += flat[i + 1] ?? 0
    }
    records.push({
      index,
      start,
      count: builder.positions.length / 3 - start,
      height,
      center: [cx / (flat.length / 2), cy / (flat.length / 2)],
    })
  })
  return { geometry: builder.geometry(), records }
}

export function buildFootprint(index: number, lift: number) {
  const builder = new Builder()
  const entry = CITY.buildings[index]
  if (!entry) return builder.geometry()
  const [height, kind, , flat] = entry
  addBuilding(builder, ring(flat), Math.max(3, height) + lift, kind, index + 1, true)
  return builder.geometry()
}
