import {
  matchesOfferStay,
  minimumOffers,
  useHotelDetails,
  useHotelOffers,
  useHotelStay,
} from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"

type Stay = components["schemas"]["SearchResponse"]["parsed"]
type Offers = components["schemas"]["HotelOffers"]
type Room = components["schemas"]["SupplierRoom"]

const UNREACHABLE = new Set(["hotel_unmapped", "provider_unavailable"])

export function roomGroups(
  content: Offers | undefined,
  catalog: readonly Room[] | undefined,
): readonly Room[] {
  if (content?.room_groups?.length) return content.room_groups
  return catalog ?? []
}

export function useRoomOffers(hotelId: string, stay?: Stay) {
  const control = useHotelStay(stay)
  const { checkIn, checkOut, adults } = control.value
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const catalog = useHotelDetails(hotelId)
  const dated = Boolean(checkIn && checkOut && checkOut > checkIn && adults)
  const current = matchesOfferStay(result.data, hotelId, checkIn, checkOut, adults)
    ? result.data
    : undefined
  const priced = current?.status === "available" && !current.sandbox ? current : undefined
  return {
    control,
    result,
    catalog,
    dated,
    current,
    priced,
    rooms: roomGroups(priced, catalog.data?.room_groups),
    status: current?.status ?? catalog.data?.status,
    unreachable: !current && UNREACHABLE.has(catalog.data?.status ?? ""),
    cheapest: minimumOffers(priced)[0],
    stayKey: `${checkIn}:${checkOut}:${adults}`,
  }
}
