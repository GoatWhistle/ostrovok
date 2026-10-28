import { fillCells, type Local } from "./scatter"

export const CELL = 2

export class Occupancy {
  private readonly cells: Uint8Array
  private readonly size: number
  private readonly x0: number
  private readonly y0: number

  constructor(center: Local, radius: number) {
    this.size = Math.ceil((radius * 2) / CELL)
    this.x0 = center[0] - radius
    this.y0 = center[1] - radius
    this.cells = new Uint8Array(this.size * this.size)
  }

  private index(x: number, y: number): number {
    const i = Math.floor((x - this.x0) / CELL)
    const j = Math.floor((y - this.y0) / CELL)
    return i < 0 || j < 0 || i >= this.size || j >= this.size ? -1 : j * this.size + i
  }

  taken(x: number, y: number): boolean {
    const at = this.index(x, y)
    return at >= 0 && this.cells[at] === 1
  }

  private mark(x: number, y: number) {
    const at = this.index(x, y)
    if (at >= 0) this.cells[at] = 1
  }

  private disc(x: number, y: number, radius: number) {
    const reach = Math.ceil(radius)
    for (let di = -reach; di <= reach; di += 1)
      for (let dj = -reach; dj <= reach; dj += 1)
        if (di * di + dj * dj <= radius * radius) this.mark(x + di * CELL, y + dj * CELL)
  }

  line(points: readonly Local[], half: number) {
    for (let index = 0; index + 1 < points.length; index += 1) {
      const [x1, y1] = points[index] ?? [0, 0]
      const [x2, y2] = points[index + 1] ?? [0, 0]
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / CELL))
      for (let s = 0; s <= steps; s += 1)
        this.disc(x1 + ((x2 - x1) * s) / steps, y1 + ((y2 - y1) * s) / steps, half / CELL)
    }
  }

  polygon(rings: readonly (readonly Local[])[]) {
    fillCells(rings, CELL, (i, j) => this.mark((i + 0.5) * CELL, (j + 0.5) * CELL))
    for (const ring of rings) this.line(ring, CELL)
  }
}
