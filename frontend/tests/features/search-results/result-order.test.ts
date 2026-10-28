import { describe, expect, it } from "vitest"
import { orderResults, parseOrder, type ResultFacts } from "@/features/search-results/result-order"
import type { SearchResult } from "@/shared/api/hotel-types"

function result(id: string, name: string, sea?: number): SearchResult {
  return {
    hotel: { id, name, location: { lon: 0, lat: 0 } },
    score: 1,
    matched:
      sea === undefined
        ? []
        : [
            {
              characteristic_key: "distance_to_sea",
              match: "full",
              label: "",
              fact: {
                fact_id: id,
                characteristic_key: "distance_to_sea",
                value: sea,
                label: "",
                confidence: 1,
                source_type: "computed",
                status: "verified",
              },
            },
          ],
  } as SearchResult
}

const facts: Record<string, ResultFacts> = {
  a: { rating: 8.1, reviews: 10 },
  b: { rating: undefined, reviews: undefined },
  c: { rating: 9.4, reviews: 300 },
}
const lookup = (id: string) => facts[id] ?? { rating: undefined, reviews: undefined }
const list = [result("a", "Beta", 300), result("b", "alpha"), result("c", "Gamma", 50)]
const ids = (items: readonly SearchResult[]) => items.map((item) => item.hotel.id)

describe("orderResults", () => {
  it("keeps the backend order for match descending", () => {
    expect(ids(orderResults(list, parseOrder("match:desc"), "en", lookup))).toEqual(["a", "b", "c"])
  })

  it("reverses the match order when ascending", () => {
    expect(ids(orderResults(list, parseOrder("match:asc"), "en", lookup))).toEqual(["c", "b", "a"])
  })

  it("sorts by rating with missing values last in both directions", () => {
    expect(ids(orderResults(list, parseOrder("rating:desc"), "en", lookup))).toEqual([
      "c",
      "a",
      "b",
    ])
    expect(ids(orderResults(list, parseOrder("rating:asc"), "en", lookup))).toEqual(["a", "c", "b"])
  })

  it("sorts by distance to the sea nearest first by default", () => {
    expect(ids(orderResults(list, parseOrder("sea"), "en", lookup))).toEqual(["c", "a", "b"])
  })

  it("sorts names with the locale collation", () => {
    expect(ids(orderResults(list, parseOrder("name:asc"), "en", lookup))).toEqual(["b", "a", "c"])
  })

  it("falls back to the default order for unknown input", () => {
    expect(parseOrder("price:up")).toEqual({ key: "match", direction: "desc" })
  })
})
