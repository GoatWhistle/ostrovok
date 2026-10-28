import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import ru from "@/shared/i18n/locales/ru/explore.json"

type AmenitySlug = keyof typeof ru.supplierAmenity
type GroupSlug = keyof typeof ru.supplierAmenityGroup

export interface SupplierText {
  readonly text: string
  readonly lang: Locale | undefined
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase("ru")
}

function reverse<Slug extends string>(dictionary: Readonly<Record<Slug, string>>) {
  return new Map(
    (Object.entries(dictionary) as [Slug, string][]).map(([slug, name]) => [normalize(name), slug]),
  )
}

const AMENITIES = reverse<AmenitySlug>(ru.supplierAmenity)
const GROUPS = reverse<GroupSlug>(ru.supplierAmenityGroup)

function original(name: string, locale: Locale): SupplierText {
  return { text: name, lang: locale === "ru" ? undefined : "ru" }
}

export function amenityName(name: string, locale: Locale): SupplierText {
  const slug = AMENITIES.get(normalize(name))
  if (!slug) return original(name, locale)
  return { text: i18n.t(`explore:supplierAmenity.${slug}`, { lng: locale }), lang: undefined }
}

export function amenityGroupName(name: string, locale: Locale): SupplierText {
  const slug = GROUPS.get(normalize(name))
  if (!slug) return original(name, locale)
  return { text: i18n.t(`explore:supplierAmenityGroup.${slug}`, { lng: locale }), lang: undefined }
}
