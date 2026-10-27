import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSurfaceScroll } from "../../../src/pages/home/use-surface-scroll"

function scrollTo(node: HTMLElement, top: number) {
  node.scrollTop = top
  node.dispatchEvent(new Event("scroll"))
}

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
    scrollTo(panel, 220)
    state.rerender({ key: "hotel:page" })
    const pageRef = state.result.current
    pageRef(page)
    scrollTo(page, 610)
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
    scrollTo(node, 400)
    state.result.current(null)
    state.rerender({ key: "hotel-b" })
    state.result.current(node)
    expect(node.scrollTop).toBe(0)
  })
})

it("preserves a visible map exit control's focus during panel restoration", () => {
  const detail = { current: null as HTMLDivElement | null }
  const state = renderHook(() => useSurfaceScroll("hotel:panel", detail))
  const panel = document.createElement("div")
  panel.tabIndex = -1
  document.body.append(panel)
  state.result.current(panel)
  state.result.current(null)
  const control = document.createElement("button")
  document.body.append(control)
  vi.spyOn(control, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 44, 44),
  ] as unknown as DOMRectList)
  control.focus()
  state.result.current(panel)
  expect(document.activeElement).toBe(control)
  control.remove()
  panel.remove()
})

it("reports restoration only for a surface with a saved position", () => {
  const detail = { current: null as HTMLDivElement | null }
  const state = renderHook(({ key }) => useSurfaceScroll(key, detail), {
    initialProps: { key: "hotel-a:page" },
  })
  expect(state.result.current.restored).toBe(false)
  const node = document.createElement("div")
  state.result.current(node)
  scrollTo(node, 900)
  state.result.current(null)
  state.rerender({ key: "hotel-a:map" })
  expect(state.result.current.restored).toBe(false)
  state.rerender({ key: "hotel-a:page" })
  expect(state.result.current.restored).toBe(true)
  state.result.current(node)
  expect(node.scrollTop).toBe(900)
})

it("keeps the saved target when a remount interrupts restoration before content grows", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  const detail = { current: null as HTMLDivElement | null }
  const state = renderHook(() => useSurfaceScroll("hotel-a:page", detail))
  const tall = document.createElement("div")
  state.result.current(tall)
  scrollTo(tall, 1200)
  state.result.current(null)
  let height = 1366
  const short = document.createElement("div")
  short.append(document.createElement("section"))
  let top = 0
  Object.defineProperty(short, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, height - 400))
    },
  })
  state.result.current(short)
  expect(short.scrollTop).toBe(966)
  state.result.current(null)
  height = 1976
  state.result.current(short)
  expect(short.scrollTop).toBe(1200)
  state.result.current(null)
  vi.unstubAllGlobals()
})

it("ignores a layout clamp that happens while the surface is being removed", () => {
  const detail = { current: null as HTMLDivElement | null }
  const state = renderHook(() => useSurfaceScroll("hotel-a:page", detail))
  const node = document.createElement("div")
  state.result.current(node)
  scrollTo(node, 1200)
  node.scrollTop = 966
  state.result.current(null)
  state.result.current(node)
  expect(node.scrollTop).toBe(1200)
})
