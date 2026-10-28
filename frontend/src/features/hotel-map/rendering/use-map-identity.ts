import { useHotel } from "@/entities/hotel"
import type { Camera, HotelSummary, SearchResult } from "@/shared/api/hotel-types"
import { hotelPoint } from "@/shared/geo/buildings/hotel-point"
import { regionOverview } from "../scene-data"

export function useMapIdentity(result: SearchResult | undefined, id: string | undefined) {
  const query = useHotel(result ? undefined : id)
  return result?.hotel ?? query.data?.hotel
}

export function identityOverview(
  identity: HotelSummary | undefined,
  region: Camera | undefined,
): Camera | undefined {
  const point = hotelPoint(identity?.location)
  return point ? { center: point, zoom: 16, pitch: 45, bearing: 0 } : regionOverview(region)
}
