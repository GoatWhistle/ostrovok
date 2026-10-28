import { useQueries } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { hotelDetailsOptions } from "@/entities/hotel"
import type { SearchResult } from "@/shared/api/hotel-types"
import { type Order, type OrderKey, parseOrder, type ResultFacts } from "./result-order"

const STORAGE_KEY = "factmap-results-order"
const DETAIL_KEYS: ReadonlySet<OrderKey> = new Set(["rating", "reviews"])

function readOrder(): Order {
  try {
    return parseOrder(window.sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return parseOrder(null)
  }
}

export function useResultOrder() {
  const [order, setOrder] = useState(readOrder)
  const change = useCallback((next: Order) => {
    setOrder(next)
    try {
      window.sessionStorage.setItem(STORAGE_KEY, `${next.key}:${next.direction}`)
    } catch {
      return
    }
  }, [])
  return { order, change }
}

export function useResultFacts(results: readonly SearchResult[], order: Order) {
  const needed = DETAIL_KEYS.has(order.key)
  const queries = useQueries({
    queries: results.map((result) => ({
      ...hotelDetailsOptions(result.hotel.id),
      enabled: needed,
    })),
  })
  const facts = new Map<string, ResultFacts>()
  results.forEach((result, index) => {
    const rating = queries[index]?.data?.details?.rating
    facts.set(result.hotel.id, {
      rating: rating?.total ?? undefined,
      reviews: rating?.reviews_count ?? undefined,
    })
  })
  const pending = needed && queries.some((query) => query.isPending && query.fetchStatus !== "idle")
  return {
    facts: (id: string) => facts.get(id) ?? { rating: undefined, reviews: undefined },
    pending,
  }
}
