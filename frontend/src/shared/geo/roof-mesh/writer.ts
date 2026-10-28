export type Point3 = readonly [number, number, number]

export const ROOF_STRIDE = 8
export const STEEL_TONE = 5
export const BRICK_TONE = 6
export const GRAVEL_TONE = 7
export const GRAVEL_TONES = 3
export const PLASTER_TONE = 10
export const PLASTER_TONES = 6
export const PALETTE_SIZE = 16

export interface RoofFrame2 {
  readonly center: readonly [number, number]
  readonly major: readonly [number, number]
  readonly minor: readonly [number, number]
  readonly base: number
}

export class RoofWriter {
  readonly vertices: number[] = []
  readonly indices: number[] = []
  private frame: RoofFrame2 = { center: [0, 0], major: [1, 0], minor: [0, 1], base: 0 }
  private pivot: Point3 = [0, 0, 0]
  wall = PLASTER_TONE

  begin(frame: RoofFrame2, rise: number) {
    this.frame = frame
    this.pivot = [frame.center[0], frame.center[1], frame.base + rise * 0.3]
  }

  private place([u, v, z]: Point3): Point3 {
    const { center, major, minor, base } = this.frame
    return [
      center[0] + u * major[0] + v * minor[0],
      center[1] + u * major[1] + v * minor[1],
      base + z,
    ]
  }

  face(points: readonly Point3[], tone: number, normal?: Point3) {
    if (points.length < 3) return
    const placed = points.map((point) => this.place(point))
    let nx = 0
    let ny = 0
    let nz = 0
    let cx = 0
    let cy = 0
    let cz = 0
    for (let index = 0; index < placed.length; index += 1) {
      const [x1, y1, z1] = placed[index] ?? [0, 0, 0]
      const [x2, y2, z2] = placed[(index + 1) % placed.length] ?? [0, 0, 0]
      nx += (y1 - y2) * (z1 + z2)
      ny += (z1 - z2) * (x1 + x2)
      nz += (x1 - x2) * (y1 + y2)
      cx += x1 / placed.length
      cy += y1 / placed.length
      cz += z1 / placed.length
    }
    if (normal) [nx, ny, nz] = normal
    const length = Math.hypot(nx, ny, nz)
    if (length === 0) return
    const [px, py, pz] = this.pivot
    const sign = normal || nx * (cx - px) + ny * (cy - py) + nz * (cz - pz) >= 0 ? 1 : -1
    const first = this.vertices.length / ROOF_STRIDE
    for (const [x, y, z] of placed)
      this.vertices.push(
        x,
        y,
        z,
        (sign * nx) / length,
        (sign * ny) / length,
        (sign * nz) / length,
        tone,
        this.frame.base,
      )
    for (let index = 1; index + 1 < placed.length; index += 1)
      this.indices.push(first, first + index, first + index + 1)
  }

  box(u: number, v: number, size: number, from: number, to: number, tone: number) {
    const saved = this.pivot
    this.pivot = this.place([u, v, (from + to) / 2])
    const h = size / 2
    const corners: Point3[] = [
      [u - h, v - h, 0],
      [u + h, v - h, 0],
      [u + h, v + h, 0],
      [u - h, v + h, 0],
    ]
    for (let index = 0; index < 4; index += 1) {
      const [au, av] = corners[index] ?? [0, 0, 0]
      const [bu, bv] = corners[(index + 1) % 4] ?? [0, 0, 0]
      this.face(
        [
          [au, av, from],
          [bu, bv, from],
          [bu, bv, to],
          [au, av, to],
        ],
        tone,
      )
    }
    this.face(
      corners.map(([cu, cv]) => [cu, cv, to] as const),
      tone,
    )
    this.pivot = saved
  }
}
