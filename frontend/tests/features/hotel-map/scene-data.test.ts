import { expect, test } from "vitest"
import { sceneData, sceneQuality } from "@/features/hotel-map/scene-data"
import type { SearchResult } from "@/shared/api/hotel-types"

test("a hotel without an imported footprint keeps the map usable", () => {
  const hotel = { footprint: null } as SearchResult
  const { buildings, highlights } = sceneData(undefined, undefined, undefined, undefined, [hotel])

  expect(() => sceneQuality(buildings, highlights)).not.toThrow()
})
