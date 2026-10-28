import { describe, expect, it } from "vitest"
import { toLocal } from "../../../src/shared/geo/roof-forms/footprint"
import { type RoofSource, roofKind } from "../../../src/shared/geo/roof-forms/tiers"
import { localFrame } from "../../../src/shared/geo/roof-mesh/frame"
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

describe("roof kinds", () => {
  it("measures the long side and width of a footprint in metres", () => {
    const frame = localFrame(toLocal(box(20, 10)).points)
    expect(frame?.length).toBeCloseTo(20, 0)
    expect(frame?.width).toBeCloseTo(10, 0)
    expect(frame?.rectangularity).toBeCloseTo(1, 2)
  })

  it("finds the true rectangle of a square footprint", () => {
    expect(localFrame(toLocal(box(12, 12)).points)?.rectangularity).toBeCloseTo(1, 2)
  })

  it("pitches low rectangular houses and keeps tall blocks flat", () => {
    expect(roofKind(house(box(20, 10)))).toBe("pitched")
    expect(roofKind(house(box(30, 20), 30))).toBe("flat")
  })

  it("leaves hotels to the flat cap and irregular footprints flat", () => {
    expect(
      roofKind({
        ...house(box(20, 10)),
        properties: { ...house(box(20, 10)).properties, hotel_id: "h" },
      }),
    ).toBe("none")
    const ell: [number, number][] = [
      [39.7, LAT],
      [39.7 + 20 * DX, LAT],
      [39.7 + 20 * DX, LAT + 4 * DY],
      [39.7 + 4 * DX, LAT + 4 * DY],
      [39.7 + 4 * DX, LAT + 20 * DY],
      [39.7, LAT + 20 * DY],
      [39.7, LAT],
    ]
    expect(roofKind(house(ell))).toBe("flat")
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
