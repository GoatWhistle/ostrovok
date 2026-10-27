import type { Map as MapLibreMap } from "maplibre-gl"
import { afterEach, expect, it, vi } from "vitest"
import { watchMapVisibility } from "@/shared/geo/engine/watch-map-visibility"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("stops when hidden, resizes only visible maps and removes observers", () => {
  let resize: ResizeObserverCallback = () => undefined
  let intersect: IntersectionObserverCallback = () => undefined
  const disconnect = vi.fn()
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const element = document.createElement("div")
  Object.defineProperties(element, { clientWidth: { value: 600 }, clientHeight: { value: 400 } })
  const map = { getContainer: () => element, stop: vi.fn(), resize: vi.fn() }
  const changed = vi.fn()
  const remove = watchMapVisibility(map as unknown as MapLibreMap, changed)
  expect(changed).toHaveBeenLastCalledWith(true)
  const resizeEntry = (width: number) =>
    resize([{ contentRect: { width, height: 400 } } as ResizeObserverEntry], {} as ResizeObserver)
  resizeEntry(0)
  expect(changed).toHaveBeenLastCalledWith(false)
  expect(map.resize).toHaveBeenCalledTimes(1)
  resizeEntry(600)
  expect(changed).toHaveBeenLastCalledWith(true)
  intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
  expect(changed).toHaveBeenLastCalledWith(false)
  const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  expect(changed).toHaveBeenLastCalledWith(false)
  hidden.mockReturnValue("visible")
  document.dispatchEvent(new Event("visibilitychange"))
  expect(changed).toHaveBeenLastCalledWith(true)
  expect(map.stop).toHaveBeenCalledTimes(2)
  remove()
  expect(disconnect).toHaveBeenCalledTimes(2)
  const calls = changed.mock.calls.length
  hidden.mockReturnValue("hidden")
  document.dispatchEvent(new Event("visibilitychange"))
  expect(changed).toHaveBeenCalledTimes(calls)
})
