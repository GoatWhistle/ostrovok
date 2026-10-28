import { amenityName } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import { type CompareCell, type CompareLine, hotelCells } from "./compare-model"

type Supplier = components["schemas"]["SupplierDetails"]

const AMENITY_LIMIT = 12
type RowKey = "rating" | "checkIn" | "checkOut" | "rooms" | "floors" | "yearBuilt" | "renovated"
const KNOWN = { kind: "status", status: "active" } as const

export interface SupplierInput {
  readonly ids: readonly string[]
  readonly supplier: (id: string) => Supplier | undefined
  readonly hotel: (id: string) => HotelSummary | undefined
  readonly locale: Locale
}

function known(text: string, rank?: number): CompareCell {
  return { text, glyph: KNOWN, rank }
}

function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function positive(value: number | null | undefined): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined
}

function ratingCell(rating: NonNullable<Supplier["rating"]>, locale: Locale) {
  if (typeof rating.total !== "number") return undefined
  const value = number(rating.total, locale)
  const text = rating.reviews_count
    ? i18n.t("explore:compare.cells.ratingReviews", {
        lng: locale,
        value,
        count: rating.reviews_count,
      })
    : i18n.t("explore:compare.cells.rating", { lng: locale, value })
  return known(text, rating.total)
}

export function supplierFactLines(input: SupplierInput): readonly CompareLine[] {
  const { ids, supplier, hotel, locale } = input
  const line = (
    key: RowKey,
    better: CompareLine["better"],
    cell: (id: string) => CompareCell | undefined,
  ): CompareLine => ({
    key,
    title: i18n.t(`explore:compare.rows.${key}`, { lng: locale }),
    better,
    cells: hotelCells(ids, cell, (value) => value),
  })
  return [
    line("rating", "higher", (id) => {
      const rating = supplier(id)?.rating
      return rating ? ratingCell(rating, locale) : undefined
    }),
    line("checkIn", null, (id) => {
      const time = supplier(id)?.check_in_from
      return time
        ? known(i18n.t("explore:compare.cells.checkIn", { lng: locale, time }))
        : undefined
    }),
    line("checkOut", null, (id) => {
      const time = supplier(id)?.check_out_until
      return time
        ? known(i18n.t("explore:compare.cells.checkOut", { lng: locale, time }))
        : undefined
    }),
    line("rooms", null, (id) => {
      const count = positive(supplier(id)?.facts.rooms_number)
      return count
        ? known(i18n.t("explore:compare.cells.rooms", { lng: locale, count }))
        : undefined
    }),
    line("floors", null, (id) => {
      const count = positive(supplier(id)?.facts.floors_number) ?? positive(hotel(id)?.levels)
      return count
        ? known(i18n.t("explore:compare.cells.floors", { lng: locale, count }))
        : undefined
    }),
    line("yearBuilt", null, (id) => {
      const year = positive(supplier(id)?.facts.year_built)
      return year ? known(String(year)) : undefined
    }),
    line("renovated", null, (id) => {
      const year = positive(supplier(id)?.facts.year_renovated)
      return year ? known(String(year)) : undefined
    }),
  ]
}

function amenityIndex(supplier: Supplier | undefined) {
  return new Map(
    (supplier?.amenity_groups ?? []).flatMap((group) =>
      group.amenities.map((item) => [item.name, item.free] as const),
    ),
  )
}

export function amenityLines(input: SupplierInput): readonly CompareLine[] {
  const { ids, supplier, locale } = input
  const indexes = new Map(ids.map((id) => [id, amenityIndex(supplier(id))] as const))
  const listed = ids.filter((id) => (indexes.get(id)?.size ?? 0) > 0)
  if (!listed.length) return []
  const coverage = new Map<string, number>()
  for (const index of indexes.values())
    for (const name of index.keys()) coverage.set(name, (coverage.get(name) ?? 0) + 1)
  const names = [...coverage.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, locale))
    .slice(0, AMENITY_LIMIT)
    .map(([name]) => name)
  const total: CompareLine = {
    key: "amenityCount",
    title: String(i18n.t("explore:compare.rows.amenityCount", { lng: locale })),
    better: "higher",
    cells: hotelCells(
      listed,
      (id) => indexes.get(id)?.size,
      (count) =>
        known(String(i18n.t("explore:compare.cells.amenities", { lng: locale, count })), count),
    ),
  }
  const rows = names.map<CompareLine>((name) => ({
    key: `amenity:${name}`,
    title: amenityName(name, locale).text,
    cells: hotelCells(
      listed,
      (id) => indexes.get(id),
      (index) => {
        const free = index.get(name)
        if (free === undefined) return undefined
        return known(
          String(
            i18n.t(
              free ? "explore:compare.cells.amenityFree" : "explore:compare.cells.amenityYes",
              {
                lng: locale,
              },
            ),
          ),
        )
      },
    ),
  }))
  return [total, ...rows]
}
