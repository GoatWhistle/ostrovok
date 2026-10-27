import type { Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it, vi } from "vitest"
import { applyMiniProfile } from "@/shared/geo/appearance/mini-profile"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import type { AppearancePackage } from "@/shared/geo/appearance/types"

function fakeMap(terrain: boolean) {
  const layers = [
    { id: "base-landcover", type: "fill" },
    { id: "buildings-flat", type: "fill" },
    { id: "overview-volumes", type: "fill-extrusion" },
    { id: "scene-volumes", type: "fill-extrusion" },
    { id: "base-roads-glow", type: "line" },
    { id: "route-glow", type: "line" },
    { id: "route-line", type: "line" },
  ]
  const ids = new Set(layers.map((layer) => layer.id))
  return {
    getTerrain: vi.fn(() => (terrain ? { source: "dem" } : null)),
    setTerrain: vi.fn(),
    getStyle: () => ({ layers }),
    getLayer: (id: string) => (ids.has(id) ? { id } : undefined),
    setLayoutProperty: vi.fn(),
  }
}

describe("minimap profile", () => {
  it.each(Object.keys(APPEARANCES) as (keyof typeof APPEARANCES)[])(
    "keeps %s flat buildings and the route while dropping heavy effects",
    (id) => {
      const map = fakeMap(true)
      applyMiniProfile(map as unknown as MapLibreMap, APPEARANCES[id])
      const hidden = map.setLayoutProperty.mock.calls.map(([layer]) => layer)
      expect(map.setTerrain).toHaveBeenCalledWith(null)
      expect(hidden).toEqual(
        expect.arrayContaining(["overview-volumes", "scene-volumes", "route-glow"]),
      )
      expect(hidden).not.toContain("buildings-flat")
      expect(hidden).not.toContain("route-line")
      expect(hidden).not.toContain("base-landcover")
    },
  )

  it("leaves layers alone when the package allows them in the minimap", () => {
    const map = fakeMap(true)
    const full: AppearancePackage = {
      ...APPEARANCES.neon,
      mini: { terrain: true, volumes: true, lights: true },
    }
    applyMiniProfile(map as unknown as MapLibreMap, full)
    expect(map.setTerrain).not.toHaveBeenCalled()
    expect(map.setLayoutProperty).not.toHaveBeenCalled()
  })

  it("does not touch terrain that is already absent", () => {
    const map = fakeMap(false)
    applyMiniProfile(map as unknown as MapLibreMap, APPEARANCES.neon)
    expect(map.setTerrain).not.toHaveBeenCalled()
  })
})
