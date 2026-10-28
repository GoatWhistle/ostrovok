import type { SearchResult } from "@/shared/api/hotel-types"

export type OrderKey = "match" | "rating" | "reviews" | "sea" | "name"
export type OrderDirection = "asc" | "desc"

export interface Order {
  readonly key: OrderKey
  readonly direction: OrderDirection
}

export interface ResultFacts {
  readonly rating: number | undefined
  readonly reviews: number | undefined
}

export const ORDER_KEYS: readonly OrderKey[] = ["match", "rating", "reviews", "sea", "name"]

export const DEFAULT_DIRECTION: Readonly<Record<OrderKey, OrderDirection>> = {
  match: "desc",
  rating: "desc",
  reviews: "desc",
  sea: "asc",
  name: "asc",
}

export const DEFAULT_ORDER: Order = { key: "match", direction: "desc" }

export function parseOrder(value: string | null): Order {
  const [key, direction] = (value ?? "").split(":")
  const known = ORDER_KEYS.find((item) => item === key)
  if (!known) return DEFAULT_ORDER
  return {
    key: known,
    direction: direction === "asc" || direction === "desc" ? direction : DEFAULT_DIRECTION[known],
  }
}

export function seaDistance(result: SearchResult): number | undefined {
  const fact = result.matched.find((item) => item.characteristic_key === "distance_to_sea")?.fact
  const value = Number(fact?.value)
  return fact && Number.isFinite(value) ? value : undefined
}

type Value = number | string | undefined

function sortValue(
  result: SearchResult,
  index: number,
  key: OrderKey,
  facts: (id: string) => ResultFacts,
): Value {
  if (key === "match") return -index
  if (key === "name") return result.hotel.name
  if (key === "sea") return seaDistance(result)
  return facts(result.hotel.id)[key]
}

function compareValues(a: Value, b: Value, direction: OrderDirection, locale: string): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
  const sign = direction === "asc" ? 1 : -1
  if (typeof a === "string" || typeof b === "string")
    return sign * String(a).localeCompare(String(b), locale)
  return sign * (a - b)
}

export function orderResults(
  results: readonly SearchResult[],
  order: Order,
  locale: string,
  facts: (id: string) => ResultFacts,
): SearchResult[] {
  return results
    .map((result, index) => ({ result, index, value: sortValue(result, index, order.key, facts) }))
    .sort((a, b) => compareValues(a.value, b.value, order.direction, locale) || a.index - b.index)
    .map((item) => item.result)
}
