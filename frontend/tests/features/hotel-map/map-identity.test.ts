import { describe, expect, it } from "vitest"
import { identityOverview } from "@/features/hotel-map/rendering/use-map-identity"
import { regionOverview } from "@/features/hotel-map/scene-data"
import type { Camera, HotelSummary } from "@/shared/api/hotel-types"

const region: Camera = { center: [39.7, 43.6], zoom: 11, pitch: 0, bearing: 0 }
const hotel: HotelSummary = { id: "hotel-a", name: "Hotel A", location: [39.72, 43.58] }

describe("map identity overview", () => {
  it("frames a hotel opened without a search result on its own coordinates", () => {
    expect(identityOverview(hotel, region)).toEqual({
      center: [39.72, 43.58],
      zoom: 16,
      pitch: 45,
      bearing: 0,
    })
  })

  it("falls back to the region overview when the hotel has no usable point", () => {
    const broken = { ...hotel, location: [Number.NaN, 43.58] }
    expect(identityOverview(broken, region)).toEqual(regionOverview(region))
    expect(identityOverview(undefined, region)).toEqual(regionOverview(region))
  })
})
