import { describe, expect, it } from "vitest"
import { nightLabelPalette } from "../../../src/shared/geo/appearance/label-palette"
import { APPEARANCES } from "../../../src/shared/geo/appearance/packages"
import { nightToken } from "../../../src/shared/geo/appearance/palette"
import type { MapAppearance } from "../../../src/shared/geo/appearance/types"
import { colorDistance, luminance } from "../../../src/shared/geo/color/hex-color"
import { skyPalette } from "../../../src/shared/geo/sun/sun-light"
import { TIMED_KEYS, timeColors, timeHex } from "../../../src/shared/geo/sun/time-tint"
import { dayColors, nightColors, tokenHex } from "./map-tokens"

const STYLES: readonly MapAppearance[] = ["neon"]
const CHECKED = [30, 5, -3, -8, -20]
const SWEEP = Array.from({ length: 101 }, (_, index) => 30 - index * 0.5)
const NIGHT_FROM = -6

function contrast(a: string, b: string): number {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

function pairwise(colors: readonly string[]): number {
  const unique = [...new Set(colors)]
  return Math.min(...unique.flatMap((a, i) => unique.slice(i + 1).map((b) => colorDistance(a, b))))
}

function across(left: readonly string[], right: readonly string[]): number {
  return Math.min(...left.flatMap((a) => right.map((b) => colorDistance(a, b))))
}

function scene(id: MapAppearance, altitude: number) {
  const { materials } = APPEARANCES[id]
  const day = dayColors(id)
  const night = nightColors(id)
  const timed = timeColors(day, night, altitude, materials.duskTint)
  const tone = (token: string) => {
    const counterpart = nightToken(id, token)
    const value = counterpart ? tokenHex(counterpart) : undefined
    return timeHex(tokenHex(token), value, day.horizonDusk, altitude, materials.duskTint)
  }
  return {
    timed,
    labels: nightLabelPalette(day, night, altitude),
    sea: skyPalette(timed, altitude).sea,
    plaster: materials.plasterTokens.map(tone),
    roofs: materials.roofTokens.map(tone),
    leaves: materials.treeTokens.leaves.map(tone),
    materials: [
      ...materials.plasterTokens,
      ...materials.roofTokens,
      ...materials.flatRoofTokens,
      ...materials.treeTokens.leaves,
    ].map(tone),
  }
}

function metrics(id: MapAppearance, altitude: number) {
  const { timed, labels, sea, plaster, roofs, leaves } = scene(id, altitude)
  return {
    parkLand: [colorDistance(timed.park, timed.land), 6],
    waterLand: [colorDistance(sea, timed.land), 7.5],
    sandLand: [colorDistance(timed.sand, timed.land), 3],
    plasterTones: [pairwise(plaster), 1.1],
    roofTones: [pairwise(roofs), 4.5],
    roofPlaster: [across(roofs, plaster), 4.5],
    leafTones: [pairwise(leaves), 1.9],
    leafPark: [across(leaves, [timed.park]), 6],
    labelLand: [contrast(labels.label, timed.land), 4.5],
    labelHalo: [contrast(labels.label, labels.labelHalo), 4.5],
    ...(altitude < NIGHT_FROM ? { roadLight: [contrast(timed.roadLight, timed.land), 3] } : {}),
  } as Record<string, readonly [number, number]>
}

describe.each(STYLES)("%s palette through the day", (id) => {
  it.each(CHECKED)("keeps every class apart with the sun at %s degrees", (altitude) => {
    const failed = Object.entries(metrics(id, altitude)).filter(
      ([, [value, threshold]]) => value < threshold,
    )
    expect(failed).toEqual([])
  })

  it("keeps ink and halo readable at every step of the evening", () => {
    for (const altitude of SWEEP) {
      const { labels } = scene(id, altitude)
      expect(contrast(labels.label, labels.labelHalo)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("changes surfaces and materials without jumps", () => {
    const steps = SWEEP.map((altitude) => {
      const { timed, materials } = scene(id, altitude)
      return [...TIMED_KEYS.map((key) => timed[key]), ...materials]
    })
    const jumps = steps
      .slice(1)
      .flatMap((step, index) =>
        step.map((color, at) => colorDistance(color, steps[index]?.[at] ?? color)),
      )
    expect(Math.max(...jumps)).toBeLessThan(8)
  })

  it("leaves the daytime palette untouched while the sun is high", () => {
    const day = dayColors(id)
    expect(timeColors(day, nightColors(id), 12, APPEARANCES[id].materials.duskTint)).toBe(day)
    expect(scene(id, 30).roofs).toEqual(APPEARANCES[id].materials.roofTokens.map(tokenHex))
  })
})
