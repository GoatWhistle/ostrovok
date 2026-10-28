import { describe, expect, it } from "vitest"
import { clusterZoom, FIT_MAX_ZOOM } from "@/features/hotel-map/rendering/fit-zoom"
import { FLIGHT_PITCH, hotelView } from "@/features/hotel-map/rendering/hotel-flight"
import type { SearchResult } from "@/shared/api/hotel-types"

function result(camera?: SearchResult["camera"]): SearchResult {
  return { hotel: { location: [39.92, 43.43] }, camera } as SearchResult
}

describe("hotelView", () => {
  it("flies from any zoom to the hotel point with a capped zoom and a tilted view", () => {
    expect(hotelView(result(), 10)).toEqual({
      center: [39.92, 43.43],
      zoom: FIT_MAX_ZOOM,
      pitch: FLIGHT_PITCH,
      bearing: 10,
    })
  })

  it("prefers the hotel camera and clamps an extreme zoom", () => {
    const camera = { center: [39.9, 43.4], zoom: 23, pitch: 60, bearing: 25 }
    const view = hotelView(result(camera as SearchResult["camera"]), 0)
    expect(view?.center).toEqual([39.9, 43.4])
    expect(view?.zoom).toBe(18)
    expect(view?.pitch).toBe(60)
  })

  it("skips hotels without coordinates", () => {
    expect(hotelView({ hotel: { location: null } } as unknown as SearchResult, 0)).toBe(undefined)
  })
})

describe("clusterZoom", () => {
  it("always zooms in at least two levels from a world view", () => {
    expect(clusterZoom(4, 3.5, 20)).toBe(5.5)
    expect(clusterZoom(9, 3.5, 20)).toBe(9)
    expect(clusterZoom(19, 15.8, 20)).toBe(FIT_MAX_ZOOM)
  })
})
