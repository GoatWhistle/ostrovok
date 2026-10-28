import { describe, expect, it } from "vitest"
import { buildRoofMesh, type RoofInput } from "../../../src/shared/geo/roof-mesh/mesh"
import { planRoof, type RoofShape } from "../../../src/shared/geo/roof-mesh/plan"
import { ROOF_STRIDE } from "../../../src/shared/geo/roof-mesh/writer"

const LAT = 43.6
const DX = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180))
const DY = 1 / 111_320

function box(width: number, depth: number, x = 0): [number, number][] {
  const west = 39.7 + x * DX
  return [
    [west, LAT],
    [west + width * DX, LAT],
    [west + width * DX, LAT + depth * DY],
    [west, LAT + depth * DY],
    [west, LAT],
  ]
}

function input(id: string, ring: [number, number][], height = 7): RoofInput {
  return { id, ring, extra: [], height, levels: 2, ground: 12, bodies: [] }
}

function heights(vertices: Float32Array): number[] {
  return Array.from({ length: vertices.length / ROOF_STRIDE }, (_, index) => {
    return vertices[index * ROOF_STRIDE + 2] ?? 0
  })
}

describe("roof plans", () => {
  it("chooses the same roof for the same building every time", () => {
    const footprint = { id: "w42", length: 14, width: 9, area: 126 }
    expect(planRoof(footprint)).toEqual(planRoof(footprint))
  })

  it("mixes several roof shapes across a street of similar houses", () => {
    const shapes = new Set<RoofShape>()
    for (let index = 0; index < 200; index += 1)
      shapes.add(planRoof({ id: `w${index}`, length: 13, width: 9, area: 117 }).shape)
    expect(shapes.size).toBeGreaterThanOrEqual(4)
  })

  it("keeps long terraces gabled or hipped, never pyramidal", () => {
    for (let index = 0; index < 100; index += 1) {
      const plan = planRoof({ id: `t${index}`, length: 40, width: 9, area: 360 })
      expect(plan.shape).not.toBe("pyramid")
      expect(plan.rise).toBeLessThanOrEqual(5.2)
    }
  })
})

describe("roof mesh", () => {
  it("raises a pitched roof from the eaves on top of the walls", () => {
    const mesh = buildRoofMesh([input("w1", box(14, 9))], [39.7, LAT])
    const z = heights(mesh.vertices)
    expect(mesh.indices.length).toBeGreaterThan(0)
    expect(Math.min(...z)).toBeCloseTo(19, 1)
    expect(Math.max(...z)).toBeGreaterThan(20)
  })

  it("puts a parapet rather than a pitched roof on a tall block", () => {
    const mesh = buildRoofMesh([input("w2", box(30, 20), 30)], [39.7, LAT])
    const z = heights(mesh.vertices)
    expect(Math.min(...z)).toBeCloseTo(42, 1)
    expect(Math.max(...z)).toBeLessThan(42 + 4)
  })

  it("skips buildings without a height", () => {
    const mesh = buildRoofMesh([input("w3", box(14, 9), 0)], [39.7, LAT])
    expect(mesh.indices.length).toBe(0)
  })
})
