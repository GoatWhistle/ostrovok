import type { components } from "@/shared/api/schema.gen"
import type { MessageKey } from "@/shared/i18n"

type Room = components["schemas"]["SupplierRoom"]

const VIEWS: Readonly<Record<string, MessageKey>> = {
  sea: "explore:roomsScreen.views.sea",
  mountain: "explore:roomsScreen.views.mountain",
  city: "explore:roomsScreen.views.city",
  park: "explore:roomsScreen.views.park",
  garden: "explore:roomsScreen.views.garden",
  courtyard: "explore:roomsScreen.views.courtyard",
  pool: "explore:roomsScreen.views.pool",
  river: "explore:roomsScreen.views.river",
  lake: "explore:roomsScreen.views.lake",
  sunrise: "explore:roomsScreen.views.sunrise",
  sunset: "explore:roomsScreen.views.sunset",
  panoramic: "explore:roomsScreen.views.panoramic",
}

export function viewKeys(room: Room): readonly MessageKey[] {
  return room.views.flatMap((code) => {
    const key = VIEWS[code]
    return key ? [key] : []
  })
}

export function roomFacts(
  room: Room,
  format: {
    readonly area: (value: number) => string
    readonly floor: (value: number) => string
    readonly places: (value: number) => string
    readonly extraPlaces: (value: number) => string
  },
): readonly string[] {
  return [
    room.size_sqm != null ? format.area(room.size_sqm) : undefined,
    room.bedding ?? undefined,
    room.main_places != null ? format.places(room.main_places) : undefined,
    room.extra_places != null ? format.extraPlaces(room.extra_places) : undefined,
    room.floor != null ? format.floor(room.floor) : undefined,
  ].filter((value): value is string => Boolean(value))
}
