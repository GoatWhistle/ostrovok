import type { components } from "@/shared/api/schema.gen"
import ru from "@/shared/i18n/locales/ru/explore.json"
import { mentions } from "./wish-terms"

type Group = components["schemas"]["SupplierAmenityGroup"]
type Amenity = components["schemas"]["SupplierAmenity"]
type Slug = keyof typeof ru.supplierAmenity

const SLUGS = new Map(
  (Object.entries(ru.supplierAmenity) as [Slug, string][]).map(([slug, name]) => [
    name.trim().toLocaleLowerCase("ru"),
    slug,
  ]),
)

const PICKS: readonly (readonly Slug[])[] = [
  ["freeWifi", "freeInternet"],
  ["privateBeach", "beachAmenities"],
  ["pool", "outdoorPool", "heatedOutdoorPool", "heatedPool", "indoorPool"],
  ["airConditioning"],
  ["breakfast", "buffetRestaurant"],
  ["parkingOnRequest", "parkingNearby"],
  ["petsAllowed"],
  ["transfer", "airportTransfer"],
  ["restaurant"],
  ["soundproofRooms"],
  ["kidsPool", "playground"],
  ["sauna", "banya", "steamRoom"],
  ["roomService"],
  ["elevator"],
]

export function pickAmenities(
  groups: readonly Group[],
  pattern: RegExp | undefined,
  limit = 8,
): Amenity[] {
  const bySlug = new Map<Slug, Amenity>()
  for (const group of groups)
    for (const item of group.amenities) {
      const slug = SLUGS.get(item.name.trim().toLocaleLowerCase("ru"))
      if (slug && !bySlug.has(slug)) bySlug.set(slug, item)
    }
  const picked = PICKS.flatMap((slot) => {
    const found = slot.map((slug) => bySlug.get(slug)).find(Boolean)
    return found ? [found] : []
  })
  const wished = picked.filter((item) => mentions(item.name, pattern))
  const rest = picked.filter((item) => !mentions(item.name, pattern))
  return [...wished, ...rest].slice(0, limit)
}
