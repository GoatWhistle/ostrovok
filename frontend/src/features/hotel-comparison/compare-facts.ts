import type { Characteristic, FactBrief } from "@/shared/api/hotel-types"
import { characteristicTitle, factLabel } from "@/shared/geo/fact-label"
import { isCurrentFact } from "@/shared/geo/facts/matching"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import type { ComparisonRow } from "./compare-diff"
import { type CellGlyph, type CompareCell, type CompareLine, hotelCells } from "./compare-model"

const QUIET_BELOW = 3
const LOUD_FROM = 7
const LOCATION_GROUPS = new Set(["location", "view", "nearby"])
const HOTEL_KEYS = new Set(["building_height"])

export type FactPlace = "location" | "hotel" | "facilities"

function registryItem(key: string, registry: readonly Characteristic[]) {
  return registry.find((item) => item.key === key || item.key === key.split(":")[0])
}

export function factPlace(key: string, registry: readonly Characteristic[]): FactPlace {
  if (HOTEL_KEYS.has(key)) return "hotel"
  const group = registryItem(key, registry)?.compare?.group
  if (group && LOCATION_GROUPS.has(group)) return "location"
  if (group === "amenities") return "facilities"
  return "hotel"
}

function factGlyph(fact: FactBrief): CellGlyph {
  if (!isCurrentFact(fact)) return { kind: "status", status: fact.status }
  if (typeof fact.value === "boolean") return { kind: "match", match: fact.value ? "full" : "none" }
  if (fact.characteristic_key === "noise_level" && typeof fact.value === "number") {
    const match = fact.value < QUIET_BELOW ? "full" : fact.value < LOUD_FROM ? "partial" : "none"
    return { kind: "match", match }
  }
  return { kind: "status", status: fact.status }
}

function factRank(fact: FactBrief): number | undefined {
  if (!isCurrentFact(fact)) return undefined
  if (typeof fact.value === "number" && Number.isFinite(fact.value)) return fact.value
  if (typeof fact.value === "boolean") return fact.value ? 1 : 0
  return undefined
}

function heightText(fact: FactBrief, locale: Locale): string | undefined {
  if (fact.characteristic_key !== "building_height" || typeof fact.value !== "number")
    return undefined
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(fact.value)
  return i18n.t("explore:supplier.metres", { lng: locale, value })
}

export function factCell(fact: FactBrief, locale: Locale): CompareCell {
  const text =
    heightText(fact, locale) ??
    wishVerdict(
      { characteristic_key: fact.characteristic_key, match: "full", label: fact.label, fact },
      locale,
    ) ??
    factLabel(fact, locale)
  return { text, glyph: factGlyph(fact), factId: fact.fact_id, rank: factRank(fact) }
}

export function characteristicLines(
  ids: readonly string[],
  rows: readonly ComparisonRow[],
  registry: readonly Characteristic[],
  locale: Locale,
): Readonly<Record<FactPlace, readonly CompareLine[]>> {
  const keys = [
    ...new Set(
      rows.flatMap((row) =>
        Object.keys(row.cells ?? {}).filter((key) => !key.startsWith("derived:")),
      ),
    ),
  ].sort()
  const lines = keys.map((key) => {
    const item = registryItem(key, registry)
    return {
      place: factPlace(key, registry),
      line: {
        key,
        title: characteristicTitle(key, locale, item?.title ?? key),
        better: item?.compare?.better,
        cells: hotelCells(
          ids,
          (id) => rows.find((row) => row.hotel_id === id)?.cells?.[key],
          (fact) => factCell(fact, locale),
        ),
      } satisfies CompareLine,
    }
  })
  const pick = (place: FactPlace) =>
    lines.filter((entry) => entry.place === place).map((entry) => entry.line)
  return { location: pick("location"), hotel: pick("hotel"), facilities: pick("facilities") }
}
