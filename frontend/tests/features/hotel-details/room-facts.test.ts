import { describe, expect, it } from "vitest"
import { roomFacts, viewKeys } from "@/features/hotel-details/rooms/room-facts"
import type { components } from "@/shared/api/schema.gen"

type Room = components["schemas"]["SupplierRoom"]

const room = (changes: Partial<Room> = {}): Room => ({
  id: "alean:abc",
  name: "Junior Suite",
  photos: [],
  amenities: [],
  views: [],
  ...changes,
})

const FORMAT = {
  area: (value: number) => `area:${value}`,
  floor: (value: number) => `floor:${value}`,
  places: (value: number) => `places:${value}`,
  extraPlaces: (value: number) => `extra:${value}`,
}

describe("roomFacts", () => {
  it("lists only the fields the supplier filled", () => {
    expect(roomFacts(room({ size_sqm: 33, main_places: 2, floor: 4 }), FORMAT)).toEqual([
      "area:33",
      "places:2",
      "floor:4",
    ])
  })

  it("keeps a room without facts empty instead of inventing them", () => {
    expect(roomFacts(room(), FORMAT)).toEqual([])
  })

  it("shows a zero floor and zero extra places as stated", () => {
    expect(roomFacts(room({ extra_places: 0, floor: 0 }), FORMAT)).toEqual(["extra:0", "floor:0"])
  })
})

describe("viewKeys", () => {
  it("maps declared view codes to dictionary keys in catalog order", () => {
    expect(viewKeys(room({ views: ["sea", "park"] }))).toEqual([
      "explore:roomsScreen.views.sea",
      "explore:roomsScreen.views.park",
    ])
  })

  it("drops a code the dictionary does not know", () => {
    expect(viewKeys(room({ views: ["kremlin", "sunset"] }))).toEqual([
      "explore:roomsScreen.views.sunset",
    ])
  })
})
