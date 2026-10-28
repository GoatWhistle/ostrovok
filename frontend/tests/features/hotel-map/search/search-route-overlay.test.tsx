import { render } from "@testing-library/react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { SearchRouteOverlay } from "@/features/hotel-map/search/search-route-overlay"

vi.mock("@/shared/motion", () => ({
  motionMs: () => 900,
  readEasing: () => "linear",
  useReducedMotion: () => false,
}))
const animate = vi.fn(() => ({ cancel: vi.fn() }))
beforeEach(() => {
  animate.mockClear()
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate })
})
afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "animate")
  vi.restoreAllMocks()
})
const map = {
  current: {
    project: () => ({ x: 100, y: 120 }),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as MapLibreMap,
}
const scene = { id: "a", name: "Hotel", location: [39, 43], place_location: [39.0001, 43.0001] }
it("shows one stable marker with no line animation for the same building", () => {
  const { container } = render(
    <SearchRouteOverlay map={map} scene={{ ...scene, mode: "onsite" }} active />,
  )
  expect(container.querySelectorAll("circle")).toHaveLength(1)
  expect(container.querySelector("path")?.getAttribute("d")).toBe("")
  expect(animate).not.toHaveBeenCalled()
})
it("does not erase and redraw the same route when it becomes the winner", () => {
  const walking = {
    ...scene,
    mode: "graph" as const,
    route: {
      type: "LineString",
      coordinates: [
        [39, 43],
        [39.001, 43.001],
      ],
    },
  }
  const { rerender } = render(<SearchRouteOverlay map={map} scene={walking} active />)
  rerender(<SearchRouteOverlay map={map} scene={JSON.parse(JSON.stringify(walking))} active />)
  expect(animate).toHaveBeenCalledTimes(1)
})
