import type { Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it, vi } from "vitest"
import type { MapAppearance } from "../../../src/shared/geo/appearance/types"
import { renderBasemap } from "../../../src/shared/geo/basemap/basemap"
import { luminance } from "../../../src/shared/geo/color/hex-color"
import { applyQuality } from "../../../src/shared/geo/engine/map-quality"
import { lightRig, sunVector } from "../../../src/shared/geo/roof-mesh/paint"
import type { MoonLight } from "../../../src/shared/geo/sun/sun-light"
import { dayColors } from "./map-tokens"

const STYLES: readonly MapAppearance[] = ["neon"]
const THIN_MOON: MoonLight = { azimuth: 120, altitude: 30, fraction: 0.05 }
const FULL_MOON: MoonLight = { azimuth: 120, altitude: 30, fraction: 1 }
const SET_MOON: MoonLight = { azimuth: 300, altitude: -20, fraction: 1 }

function hex(rgb: readonly number[]): string {
  return `#${rgb
    .map((value) =>
      Math.round(Math.min(1, value) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

function litRatio(id: MapAppearance, moon: MoonLight | undefined): number {
  const rig = lightRig(dayColors(id), 200, -20, { moon })
  const lit = rig.ambient.map((value, index) => value + (rig.light[index] ?? 0))
  return (luminance(hex(lit)) + 0.05) / (luminance(hex(rig.ambient)) + 0.05)
}

describe.each(STYLES)("%s night light", (id) => {
  it.each([
    ["no moon", SET_MOON],
    ["a thin moon", THIN_MOON],
    ["a full moon", FULL_MOON],
  ])("lights one side of walls and crowns brighter than the other under %s", (_, moon) => {
    expect(litRatio(id, moon)).toBeGreaterThanOrEqual(1.3)
  })

  it("takes the direction from the moon while it is up", () => {
    const [x, y, z] = lightRig(dayColors(id), 200, -20, { moon: FULL_MOON }).sun
    const [mx, my, mz] = sunVector(FULL_MOON.azimuth, FULL_MOON.altitude)
    expect(x).toBeCloseTo(mx, 3)
    expect(y).toBeCloseTo(my, 3)
    expect(z).toBeCloseTo(mz, 3)
  })

  it("ignores the moon in daylight", () => {
    expect(lightRig(dayColors(id), 180, 40, { moon: FULL_MOON })).toEqual(
      lightRig(dayColors(id), 180, 40),
    )
  })
})

function fakeMap() {
  const layers = new Map<string, Record<string, unknown>>([["base-roads-glow", {}]])
  return {
    getSource: () => ({}),
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getLayoutProperty: (id: string, key: string) => layers.get(id)?.[key],
    setLayoutProperty: vi.fn((id: string, key: string, value: unknown) => {
      layers.set(id, { ...layers.get(id), [key]: value })
    }),
    setPaintProperty: vi.fn(),
    getPixelRatio: () => 1,
    setPixelRatio: vi.fn(),
  }
}

function paintOf(map: ReturnType<typeof fakeMap>, layer: string, key: string) {
  return map.setPaintProperty.mock.calls.find(([id, name]) => id === layer && name === key)?.[2]
}

describe("street light at night", () => {
  const colors = dayColors("toy-town")

  it("widens and brightens lit streets as the night deepens", () => {
    const day = fakeMap()
    const night = fakeMap()
    renderBasemap(day as unknown as MapLibreMap, colors, 0)
    renderBasemap(night as unknown as MapLibreMap, colors, 1)
    expect(paintOf(day, "base-roads-light", "line-opacity")).toBe(0.7)
    expect(paintOf(night, "base-roads-light", "line-opacity")).toBeGreaterThan(0.9)
    expect(paintOf(day, "base-roads-light", "line-width")).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      13,
      0.4,
      18,
      1.8,
    ])
    expect(JSON.stringify(paintOf(night, "base-roads-light", "line-width"))).toContain("2.88")
  })

  it("shows the street glow at night even where the style has no daytime glow", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 })
    const map = fakeMap()
    applyQuality(map as unknown as MapLibreMap, 1, false, true)
    expect(map.getLayoutProperty("base-roads-glow", "visibility")).toBe("visible")
    applyQuality(map as unknown as MapLibreMap, 0, false, false)
    expect(map.getLayoutProperty("base-roads-glow", "visibility")).toBe("none")
    applyQuality(map as unknown as MapLibreMap, 2, true, true)
    expect(map.getLayoutProperty("base-roads-glow", "visibility")).toBe("none")
    vi.unstubAllGlobals()
  })
})
