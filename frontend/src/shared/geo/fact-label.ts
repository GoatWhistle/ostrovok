import type { Fact, FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

function number(value: unknown, locale: Locale) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
        maximumFractionDigits: 1,
      }).format(value)
    : null
}

function noiseLabel(value: unknown, locale: Locale): string {
  if (typeof value !== "number") return i18n.t("explore:facts.noiseUnknown", { lng: locale })
  if (value < 3) return i18n.t("explore:facts.noiseQuiet", { lng: locale })
  if (value < 7) return i18n.t("explore:facts.noiseModerate", { lng: locale })
  return i18n.t("explore:facts.noiseLoud", { lng: locale })
}

export function factLabel(fact: FactBrief, locale: Locale): string {
  const value = number(fact.value, locale)
  if (fact.characteristic_key === "building_height" && value)
    return i18n.t("explore:facts.buildingHeight", { value, lng: locale })
  if (fact.characteristic_key === "distance_to_sea" && value)
    return i18n.t("explore:facts.distanceToSea", { value, lng: locale })
  if (fact.characteristic_key === "noise_level") return noiseLabel(fact.value, locale)
  if (fact.characteristic_key === "double_room")
    return fact.value === true
      ? i18n.t("explore:facts.doubleRoomAvailable", { lng: locale })
      : i18n.t("explore:facts.doubleRoomUnknown", { lng: locale })
  if (fact.characteristic_key.startsWith("nearby:") && value)
    return i18n.t("explore:facts.nearbyObjects", { count: value, lng: locale })
  return fact.label
}

export function matchedTitle(item: MatchedProperty, locale: Locale): string {
  if (item.characteristic_key.startsWith("nearby:")) return item.label
  return item.fact
    ? factLabel(item.fact, locale)
    : characteristicTitle(item.characteristic_key, locale)
}

export function matchedExplanation(item: MatchedProperty, locale: Locale): string | undefined {
  if (item.characteristic_key.startsWith("nearby:")) {
    const parts = item.characteristic_key.split(":")
    const radius = Number(parts[4])
    return i18n.t("explore:map.nearbyEvidence", {
      lng: locale,
      radius: Number.isFinite(radius) ? radius : 500,
      open: parts[3] === "1" ? i18n.t("explore:map.openAllDay", { lng: locale }) : "",
    })
  }
  if (locale === "ru") return item.explanation ?? undefined
  if (!item.fact) return i18n.t("explore:map.noEvidence", { lng: locale })
  if (item.characteristic_key === "distance_to_sea")
    return i18n.t("explore:map.walkEvidence", { lng: locale })
  return i18n.t("explore:map.genericEvidence", { lng: locale })
}

export function factExplanation(fact: Fact, locale: Locale): string | undefined {
  if (fact.characteristic_key.startsWith("nearby:")) {
    const parts = fact.characteristic_key.split(":")
    const radius = Number(parts[4])
    return i18n.t("explore:map.nearbyEvidence", {
      lng: locale,
      radius: Number.isFinite(radius) ? radius : 500,
      open: parts[3] === "1" ? i18n.t("explore:map.openAllDay", { lng: locale }) : "",
    })
  }
  if (fact.characteristic_key === "noise_level")
    return i18n.t("explore:facts.noiseExplanation", { lng: locale })
  if (locale === "ru") return fact.explanation ?? undefined
  return i18n.t(
    fact.characteristic_key === "distance_to_sea"
      ? "explore:map.walkEvidence"
      : "explore:map.genericEvidence",
    { lng: locale },
  )
}

export function characteristicTitle(key: string, locale: Locale): string {
  if (key.startsWith("nearby:")) return i18n.t("explore:facts.titleNearby", { lng: locale })
  switch (key) {
    case "distance_to_sea":
      return i18n.t("explore:facts.titleSea", { lng: locale })
    case "noise_level":
      return i18n.t("explore:facts.titleNoise", { lng: locale })
    case "building_height":
      return i18n.t("explore:facts.titleHeight", { lng: locale })
    case "sunset_view":
      return i18n.t("explore:facts.titleSunset", { lng: locale })
    case "pets_policy":
      return i18n.t("explore:facts.titlePets", { lng: locale })
    case "blackout_curtains":
      return i18n.t("explore:facts.titleBlackout", { lng: locale })
    case "double_room":
      return i18n.t("explore:facts.titleDoubleRoom", { lng: locale })
    default:
      return key
  }
}
