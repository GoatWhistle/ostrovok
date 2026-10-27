import type { MatchedProperty } from "@/shared/api/hotel-types"
import { petsLabel } from "@/shared/geo/facts/pets"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

const QUIET_BELOW = 3
const LOUD_FROM = 7
const ROUND_METERS = 10

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function format(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 1,
  }).format(value)
}

function seaVerdict(minutes: number | undefined, meters: number | undefined, locale: Locale) {
  if (minutes === undefined) return undefined
  const walk = i18n.t("explore:wish.sea", { lng: locale, minutes: format(minutes, locale) })
  if (meters === undefined) return walk
  const rounded = format(Math.round(meters / ROUND_METERS) * ROUND_METERS, locale)
  return i18n.t("explore:wish.seaMeters", { lng: locale, walk, value: rounded })
}

function noiseVerdict(score: number | undefined, locale: Locale) {
  if (score === undefined) return undefined
  const key =
    score < QUIET_BELOW
      ? "explore:wish.quiet"
      : score < LOUD_FROM
        ? "explore:wish.moderate"
        : "explore:wish.loud"
  return i18n.t(key, { lng: locale, score: format(score, locale) })
}

function knownVerdict(key: string, value: unknown, meters: unknown, locale: Locale) {
  const number = numeric(value)
  if (key === "distance_to_sea") return seaVerdict(number, numeric(meters), locale)
  if (key === "noise_level") return noiseVerdict(number, locale)
  if (key === "pets_policy") return petsLabel(value, locale)
  if (key === "building_height" && number !== undefined)
    return i18n.t("explore:wish.height", { lng: locale, value: format(number, locale) })
  if (key.startsWith("nearby:") && number !== undefined)
    return i18n.t("explore:wish.nearby", { lng: locale, count: number })
  if (key === "sunset_view" && typeof value === "boolean")
    return i18n.t(value ? "explore:wish.sunset" : "explore:wish.noSunset", { lng: locale })
  return undefined
}

export function wishVerdict(item: MatchedProperty, locale: Locale): string | undefined {
  const qualifiers = item.fact?.qualifiers ?? {}
  const native = qualifiers.native_characteristic_key
  const key = typeof native === "string" ? native : item.characteristic_key
  const value = typeof native === "string" ? qualifiers.native_value : item.fact?.value
  const known = knownVerdict(key, value, qualifiers.meters, locale)
  if (known) return known
  if (item.match === "computing") return i18n.t("explore:wish.computing", { lng: locale })
  if (item.match !== "unknown") return undefined
  return i18n.t(
    qualifiers.wish_status === "incomplete" ? "explore:wish.incomplete" : "explore:wish.noData",
    { lng: locale },
  )
}
