import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useWorkspaceExpansion } from "@/features/hotel-search/use-workspace-expansion"

describe("workspace expansion", () => {
  it("opens only for a nonempty result and keeps that decision within its conversation", () => {
    const state = renderHook(({ scope, hotels }) => useWorkspaceExpansion(scope, hotels), {
      initialProps: { scope: "expand-a", hotels: false },
    })
    expect(state.result.current).toBe(false)
    state.rerender({ scope: "expand-a", hotels: true })
    expect(state.result.current).toBe(true)
    state.rerender({ scope: "expand-a", hotels: false })
    expect(state.result.current).toBe(true)
    state.rerender({ scope: "expand-b", hotels: false })
    expect(state.result.current).toBe(false)
    act(() => sessionStorage.setItem("hotel-workspace-open:expand-loaded", "true"))
    state.rerender({ scope: "expand-loaded", hotels: false })
    expect(state.result.current).toBe(true)
  })
})
