import { act, renderHook } from "@testing-library/react"
import { expect, it } from "vitest"
import { useListReturn } from "@/features/hotel-search/use-list-return"

it("restores scroll after expanding the map without selecting a hotel", () => {
  const state = renderHook(() => useListReturn("chat-a", undefined, 20))
  const first = document.createElement("div")
  act(() => state.result.current.listRef(first))
  first.scrollTop = 1830
  act(() => state.result.current.listRef(null))
  const returned = document.createElement("div")
  act(() => state.result.current.listRef(returned))
  expect(returned.scrollTop).toBe(1830)
})
