import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useSurfaceScroll } from "../../../src/pages/home/use-surface-scroll"

describe("hotel surface scroll", () => {
  it("keeps page and panel positions independent when an outgoing panel detaches later", () => {
    const detail = { current: null as HTMLDivElement | null }
    const state = renderHook(({ key }) => useSurfaceScroll(key, detail), {
      initialProps: { key: "hotel:panel" },
    })
    const panel = document.createElement("div")
    const page = document.createElement("div")
    const panelRef = state.result.current
    panelRef(panel)
    panel.scrollTop = 220
    state.rerender({ key: "hotel:page" })
    const pageRef = state.result.current
    pageRef(page)
    page.scrollTop = 610
    panelRef(null)
    expect(detail.current).toBe(page)
    pageRef(null)
    state.rerender({ key: "hotel:panel" })
    state.result.current(panel)
    expect(panel.scrollTop).toBe(220)
    state.result.current(null)
    state.rerender({ key: "hotel:page" })
    state.result.current(page)
    expect(page.scrollTop).toBe(610)
  })
  it("does not restore another hotel's position", () => {
    const detail = { current: null as HTMLDivElement | null }
    const state = renderHook(({ key }) => useSurfaceScroll(key, detail), {
      initialProps: { key: "hotel-a" },
    })
    const node = document.createElement("div")
    state.result.current(node)
    node.scrollTop = 400
    state.result.current(null)
    state.rerender({ key: "hotel-b" })
    state.result.current(node)
    expect(node.scrollTop).toBe(0)
  })
})
