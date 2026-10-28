import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSearchRating } from "@/features/hotel-map/search/use-search-rating"
import type { SearchJourney } from "@/shared/api/search-journey"

vi.mock("@/entities/hotel", () => ({ hotelDetailsOptions: (id: string) => ({ id }) }))
vi.mock("@tanstack/react-query", () => ({
  useQueries: ({ queries }: { queries: { id: string }[] }) =>
    queries.map(({ id }) => ({
      isPending: false,
      data: { details: { rating: { total: id === "high" ? 9.4 : 8.1 } } },
    })),
}))
const first = { id: "first", name: "First", location: [39, 43] }
const high = { id: "high", name: "High", location: [39.1, 43.1] }
const journey: SearchJourney = {
  request: 1,
  sending: false,
  status: "done",
  location: "City",
  bounds: undefined,
  candidates: [first, high],
  finalists: [first, high],
  winner: first,
}

describe("search rating", () => {
  it.each(["sunset", "dogs"])("focuses the best rated eligible %s hotel", () => {
    const { result } = renderHook(() => useSearchRating(journey))
    expect(result.current?.id).toBe("high")
    expect(result.current?.rating).toBe(9.4)
  })
  it("does not replace a confirmed same-building winner with a higher rated hotel", () => {
    const { result } = renderHook(() =>
      useSearchRating({ ...journey, winner: { ...first, mode: "onsite", meters: 0 } }),
    )
    expect(result.current).toBeUndefined()
  })
})
