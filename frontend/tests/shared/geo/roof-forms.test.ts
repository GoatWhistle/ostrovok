import { describe, expect, it } from "vitest"
import { roofFrame } from "../../../src/shared/geo/roof-forms/footprint"
import { pitchedRoof, type RoofSource } from "../../../src/shared/geo/roof-forms/tiers"
import { darkness, sunLight, warmth } from "../../../src/shared/geo/sun-light"
import { tintHex } from "../../../src/shared/geo/time-tint"

const LAT = 43.6
const DX = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180))
const DY = 1 / 111_320

function box(width: number, depth: number): [number, number][] {
  return [
    [39.7, LAT],
    [39.7 + width * DX, LAT],
    [39.7 + width * DX, LAT + depth * DY],
    [39.7, LAT + depth * DY],
    [39.7, LAT],
  ]
}

function house(ring: [number, number][], height = 7, id = "w1"): RoofSource {
  return {
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { building_id: id, hotel_id: null, levels: 2, render_height_m: height },
  }
}

describe("pitched roofs", () => {
  it("measures the long side and width of a footprint in metres", () => {
    const frame = roofFrame(box(20, 10))
    expect(frame?.length).toBeCloseTo(20, 0)
    expect(frame?.width).toBeCloseTo(10, 0)
    expect(frame?.rectangularity).toBeCloseTo(1, 2)
  })

  it("stacks narrowing tiers from the eaves up to the ridge", () => {
    const tiers = pitchedRoof(house(box(20, 10)))
    expect(tiers).toHaveLength(4)
    expect(tiers[0]?.properties?.base).toBe(7)
    const tops = tiers.map((tier) => tier.properties?.top as number)
    expect(tops).toEqual([...tops].sort((a, b) => a - b))
    expect(tops.at(-1)).toBeLessThanOrEqual(7 + 4.5)
    const top = tiers.at(-1)?.geometry.coordinates[0] ?? []
    const frame = roofFrame(top as [number, number][])
    expect(frame?.width).toBeLessThan(3)
  })

  it("puts a parapet and a recessed deck on tall blocks", () => {
    const [parapet, deck] = pitchedRoof(house(box(30, 20), 30))
    expect(parapet?.properties?.edge).toBe(true)
    expect(parapet?.geometry.coordinates).toHaveLength(2)
    expect(parapet?.properties?.top).toBeCloseTo(30.9)
    expect(deck?.properties?.top).toBeCloseTo(30.3)
  })

  it("leaves hotels and irregular footprints to the flat cap", () => {
    expect(
      pitchedRoof({
        ...house(box(20, 10)),
        properties: { ...house(box(20, 10)).properties, hotel_id: "h" },
      }),
    ).toHaveLength(0)
    const ell: [number, number][] = [
      [39.7, LAT],
      [39.7 + 20 * DX, LAT],
      [39.7 + 20 * DX, LAT + 4 * DY],
      [39.7 + 4 * DX, LAT + 4 * DY],
      [39.7 + 4 * DX, LAT + 20 * DY],
      [39.7, LAT + 20 * DY],
      [39.7, LAT],
    ]
    expect(pitchedRoof(house(ell))).toHaveLength(0)
  })
})

describe("sun light", () => {
  const colors = {
    sea: "#b9d7e2",
    seaDusk: "#9fc0cf",
    seaNight: "#39566b",
    sky: "#dbe9f2",
    skyDusk: "#e8cfbd",
    skyNight: "#2a3b4d",
    horizon: "#dbe9f2",
    horizonDusk: "#e8cfbd",
    horizonNight: "#1d2b3d",
    sunlight: "#fffaf0",
    sunLow: "#ffcf9e",
    moonlight: "#dbe9f2",
  }

  it("warms the light towards the horizon and darkens it only after sunset", () => {
    expect(warmth(45)).toBe(0)
    expect(warmth(3)).toBeGreaterThan(0.9)
    expect(darkness(2)).toBe(0)
    expect(darkness(-12)).toBe(1)
    expect(sunLight(colors, 180, 60).color).toBe("#fffaf0")
  })

  it("changes the light colour without jumps as the sun sets", () => {
    const steps = Array.from({ length: 41 }, (_, index) => 20 - index)
    const channels = steps.map((altitude) =>
      Number.parseInt(sunLight(colors, 180, altitude).color.slice(1, 3), 16),
    )
    const jumps = channels.slice(1).map((value, index) => Math.abs(value - (channels[index] ?? 0)))
    expect(Math.max(...jumps)).toBeLessThan(40)
  })

  it("never lights buildings from below the horizon", () => {
    const polar = sunLight(colors, 90, -2).position[2]
    expect(polar).toBeLessThanOrEqual(72)
  })

  it("tints roof colours with the same twilight as the ground", () => {
    expect(tintHex("#b4513f", colors, 45)).toBe("#b4513f")
    expect(tintHex("#b4513f", colors, -20)).not.toBe(tintHex("#b4513f", colors, 2))
  })
})
