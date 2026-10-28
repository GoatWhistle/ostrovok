import { describe, expect, it } from "vitest"
import { CELL, Occupancy } from "../../../src/shared/geo/tree-mesh/occupancy"
import { fillCells, RULES, treeAt } from "../../../src/shared/geo/tree-mesh/scatter"

const square = [
  [0, 0],
  [40, 0],
  [40, 40],
  [0, 40],
  [0, 0],
] as const

describe("tree scatter", () => {
  it("puts the same tree in the same grid cell every time", () => {
    const rule = RULES.park
    if (!rule) throw new Error("missing park rule")
    expect(treeAt(12, -7, rule)).toEqual(treeAt(12, -7, rule))
  })

  it("visits only cells inside the polygon", () => {
    const cells: [number, number][] = []
    fillCells([square], 10, (i, j) => cells.push([i, j]))
    expect(cells).toHaveLength(16)
    expect(cells.every(([i, j]) => i >= 0 && i < 4 && j >= 0 && j < 4)).toBe(true)
  })

  it("thins a forest less than a lawn", () => {
    const count = (name: string) => {
      const rule = RULES[name]
      if (!rule) return 0
      let kept = 0
      for (let i = 0; i < 40; i += 1)
        for (let j = 0; j < 40; j += 1) if (treeAt(i, j, rule)) kept += 1
      return kept
    }
    expect(count("wood")).toBeGreaterThan(count("grass"))
  })
})

describe("tree occupancy", () => {
  it("keeps trees off roads but allows the verge", () => {
    const grid = new Occupancy([0, 0], 100)
    grid.line(
      [
        [-50, 0],
        [50, 0],
      ],
      4,
    )
    expect(grid.taken(0, 1)).toBe(true)
    expect(grid.taken(0, 4 + CELL * 2)).toBe(false)
  })

  it("keeps trees out of building footprints", () => {
    const grid = new Occupancy([20, 20], 100)
    grid.polygon([square])
    expect(grid.taken(20, 20)).toBe(true)
    expect(grid.taken(60, 60)).toBe(false)
  })
})
