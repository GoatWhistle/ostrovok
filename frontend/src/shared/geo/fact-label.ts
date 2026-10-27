import type { Fact, FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import { petsLabel } from "./facts/pets"
import { sunsetExplanation } from "./sunset-explanation"
import { viewExplanation } from "./view-explanation"

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

export function matchedValue(fact: FactBrief | undefined, locale: Locale): string {
  const value = number(fact?.value, locale)
  if (fact?.characteristic_key === "distance_to_sea" && value !== null)
    return i18n.t("explore:map.walkShort", { value, lng: locale })
  if (fact?.characteristic_key.startsWith("nearby:") && value !== null) return value
  return i18n.t("explore:map.focusDetails", { lng: locale })
}

export function factLabel(fact: FactBrief, locale: Locale): string {
  if (fact.characteristic_key === "pets_policy") return petsLabel(fact.value, locale)
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
  if (fact.characteristic_key === "room_capacity" && value)
    return i18n.t("explore:facts.roomCapacity", { value, lng: locale })
  if (fact.characteristic_key.startsWith("nearby:") && value)
    return i18n.t("explore:facts.nearbyObjects", { count: value, lng: locale })
  return fact.label
}

export function matchedTitle(item: MatchedProperty, locale: Locale): string {
  if (
    item.characteristic_key.startsWith("nearby:") ||
    item.characteristic_key.startsWith("facility:") ||
    item.characteristic_key.startsWith("derived:")
  )
    return item.label
  return item.fact
    ? factLabel(item.fact, locale)
    : characteristicTitle(item.characteristic_key, locale)
}

function windowExplanation(fact: FactBrief | undefined, locale: Locale): string | undefined {
  if (!fact?.characteristic_key.startsWith("spatial:")) return undefined
  if (typeof fact.value !== "boolean" && fact.value !== null && fact.value !== undefined)
    return undefined
  return i18n.t(
    fact.value === true
      ? "explore:map.viewVisible"
      : fact.value === false
        ? "explore:map.viewBlocked"
        : "explore:map.viewUnknown",
    { lng: locale },
  )
}

export function matchedExplanation(item: MatchedProperty, locale: Locale): string | undefined {
  if (item.characteristic_key.startsWith("facility:"))
    return locale === "ru"
      ? (item.explanation ?? undefined)
      : i18n.t("explore:map.supplierEvidence", { lng: locale })
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
  const view = windowExplanation(item.fact ?? undefined, locale)
  if (view) return view
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
  const view =
    sunsetExplanation(fact, locale) ??
    viewExplanation(fact, locale) ??
    windowExplanation(fact, locale)
  if (view) return view
  return i18n.t(
    fact.characteristic_key === "distance_to_sea"
      ? "explore:map.walkEvidence"
      : "explore:map.genericEvidence",
    { lng: locale },
  )
}

export function characteristicTitle(key: string, locale: Locale, label = key): string {
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
    case "room_capacity":
      return i18n.t("explore:facts.titleRoomCapacity", { lng: locale })
    default:
      return label
  }
}
