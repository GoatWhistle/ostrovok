import type { Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it, vi } from "vitest"
import { followTerrainZoom } from "@/shared/geo/terrain/terrain"

function fakeMap(zoom: number, terrain: boolean) {
  let current: unknown = terrain ? { source: "sochi-dem" } : null
  return {
    getZoom: () => zoom,
    getTerrain: () => current,
    setTerrain: vi.fn((value: unknown) => {
      current = value
    }),
    on: vi.fn(),
    off: vi.fn(),
  }
}

describe("terrain follows zoom and quality", () => {
  it("drapes terrain at city zoom when quality allows it", () => {
    const map = fakeMap(15, false)
    followTerrainZoom(map as unknown as MapLibreMap)
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.any(String) }),
    )
  })

  it("removes terrain at the lowest quality level", () => {
    const map = fakeMap(15, true)
    followTerrainZoom(map as unknown as MapLibreMap, false)
    expect(map.setTerrain).toHaveBeenCalledWith(null)
  })
})
