import { useState } from "react"
import type { Camera, FactBrief, MatchedProperty } from "@/shared/api/hotel-types"

interface HotelSelection {
  readonly placeId: string | undefined
  readonly factId: string | undefined
  readonly camera: Camera | undefined
  readonly previewRefs: readonly string[] | undefined
  readonly previewMatch: MatchedProperty | undefined
  readonly geoRefs: readonly string[]
  readonly focusedFact: FactBrief | undefined
  readonly focusedMatch: MatchedProperty | undefined
}

const EMPTY: HotelSelection = {
  placeId: undefined,
  factId: undefined,
  camera: undefined,
  previewRefs: undefined,
  previewMatch: undefined,
  geoRefs: [],
  focusedFact: undefined,
  focusedMatch: undefined,
}

export function useHotelSelection(scope: string, hotelId: string | undefined) {
  const [records, setRecords] = useState<ReadonlyMap<string, HotelSelection>>(() => new Map())
  const key = (hotel: string | undefined) => `${scope}:${hotel ?? ""}`
  function update(patch: Partial<HotelSelection>, hotel = hotelId) {
    setRecords((previous) =>
      new Map(previous).set(key(hotel), { ...(previous.get(key(hotel)) ?? EMPTY), ...patch }),
    )
  }
  return {
    state: records.get(key(hotelId)) ?? EMPTY,
    update,
    clear: () => update(EMPTY),
    select: (hotel: string, camera: Camera | undefined) => update({ ...EMPTY, camera }, hotel),
  }
}
