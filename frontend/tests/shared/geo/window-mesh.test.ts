import { describe, expect, it } from "vitest"
import { buildWindowMesh, seedOf, WINDOW_STRIDE } from "@/shared/geo/night-city/window-mesh"

const square = (size: number): [number, number][] => {
  const step = size / 111_320
  return [
    [39.9, 43.44],
    [39.9 + step, 43.44],
    [39.9 + step, 43.44 + step],
    [39.9, 43.44 + step],
    [39.9, 43.44],
  ]
}

describe("buildWindowMesh", () => {
  it("builds one quad per wall from the building base to its roof", () => {
    const mesh = buildWindowMesh(
      [{ id: "b1", rings: [square(20)], ground: 30, base: 0, height: 12 }],
      [39.9, 43.44],
    )
    expect(mesh.vertices.length / WINDOW_STRIDE).toBe(16)
    expect(mesh.indices.length).toBe(24)
    const heights = new Set<number>()
    for (let index = 2; index < mesh.vertices.length; index += WINDOW_STRIDE)
      heights.add(Math.round(mesh.vertices[index] ?? 0))
    expect([...heights].sort()).toEqual([30, 42])
  })

  it("covers holes, skips short walls and low buildings", () => {
    const hole = square(6).map(([lon, lat]) => [lon + 0.00003, lat + 0.00003] as [number, number])
    const mesh = buildWindowMesh(
      [
        { id: "ring", rings: [square(20), hole], ground: 0, base: 0, height: 9 },
        { id: "kiosk", rings: [square(20)], ground: 0, base: 0, height: 2 },
        { id: "tiny", rings: [square(1)], ground: 0, base: 0, height: 20 },
      ],
      [39.9, 43.44],
    )
    expect(mesh.indices.length / 6).toBe(8)
  })

  it("gives every building a stable seed", () => {
    expect(seedOf("w123")).toBe(seedOf("w123"))
    expect(seedOf("w123")).not.toBe(seedOf("w124"))
    expect(seedOf("w123")).toBeGreaterThanOrEqual(0)
    expect(seedOf("w123")).toBeLessThan(1)
  })
})

describe("window wall offset", () => {
  it("puts the middle of every window quad just outside its wall for either ring direction", () => {
    const ring = square(20)
    const width = 20 * Math.cos((43.44 * Math.PI) / 180)
    for (const rings of [[ring], [[...ring].reverse()]]) {
      const mesh = buildWindowMesh(
        [{ id: "b", rings, ground: 0, base: 0, height: 9 }],
        [39.9, 43.44],
      )
      const quad = 4 * WINDOW_STRIDE
      for (let start = 0; start < mesh.vertices.length; start += quad) {
        const x =
          ((mesh.vertices[start] ?? 0) + (mesh.vertices[start + 2 * WINDOW_STRIDE] ?? 0)) / 2
        const y =
          ((mesh.vertices[start + 1] ?? 0) + (mesh.vertices[start + 2 * WINDOW_STRIDE + 1] ?? 0)) /
          2
        const inside = x > 0 && x < width && y < 0 && y > -20
        expect(inside).toBe(false)
      }
    }
  })
})
