import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSearchTour } from "@/features/hotel-map/search/use-search-tour"
import type { SearchJourney } from "@/shared/api/search-journey"

vi.mock("@/features/hotel-map/search/use-search-rating", () => ({
  useSearchRating: () => undefined,
}))
vi.mock("@/shared/motion", () => ({ motionMs: () => 4200 }))
const first = {
  id: "first",
  name: "First",
  location: [39, 43],
  mode: "graph" as const,
  route: {
    type: "LineString",
    coordinates: [
      [39, 43],
      [39.01, 43.01],
    ],
  },
}
const second = { ...first, id: "second", name: "Second", location: [39.1, 43.1] }
const journey: SearchJourney = {
  request: 1,
  sending: true,
  status: "checking",
  location: "City",
  bounds: undefined,
  candidates: [first, second],
  previews: [first, second],
}
afterEach(() => vi.useRealTimers())

describe("search tour", () => {
  it("switches candidates while searching and immediately uses the winner", () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useSearchTour(value, false), {
      initialProps: { value: journey },
    })
    expect(result.current?.id).toBe("first")
    act(() => vi.advanceTimersByTime(4200))
    expect(result.current?.id).toBe("second")
    rerender({ value: { ...journey, winner: first, sending: false } })
    expect(result.current?.id).toBe("first")
    act(() => vi.advanceTimersByTime(8400))
    expect(result.current?.id).toBe("first")
  })
  it("does not tour with reduced motion and resets on replacement", () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useSearchTour(value, true), {
      initialProps: { value: journey },
    })
    act(() => vi.advanceTimersByTime(8400))
    expect(result.current?.id).toBe("first")
    rerender({ value: { ...journey, request: 2, candidates: [second], previews: [second] } })
    expect(result.current?.id).toBe("second")
  })
  it("does not keep a candidate after an empty result or failure", () => {
    const { result, rerender } = renderHook(({ value }) => useSearchTour(value, false), {
      initialProps: { value: journey },
    })
    rerender({ value: { ...journey, sending: false, status: "empty" } })
    expect(result.current).toBeUndefined()
  })
})

it("shows walking comparisons before cycling through onsite matches", () => {
  const onsite = { ...first, mode: "onsite" as const }
  const walking = { ...second, mode: "graph" as const }
  const { result } = renderHook(() =>
    useSearchTour({ ...journey, previews: [onsite, walking] }, false),
  )
  expect(result.current?.id).toBe("second")
})
it("stays on one onsite match instead of flying between buildings without routes", () => {
  vi.useFakeTimers()
  const previews = [first, second].map((scene) => ({ ...scene, mode: "onsite" as const }))
  const { result } = renderHook(() => useSearchTour({ ...journey, previews }, false))
  act(() => vi.advanceTimersByTime(4200))
  expect(result.current?.id).toBe("first")
})
