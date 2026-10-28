import { act, renderHook } from "@testing-library/react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it, vi } from "vitest"
import { useSearchCamera } from "@/features/hotel-map/search/use-search-camera"
import type { SearchJourney } from "@/shared/api/search-journey"

const flights = vi.hoisted(() => ({ scene: vi.fn(), area: vi.fn() }))
vi.mock("@/features/hotel-map/search/search-camera", () => ({
  flyToSearchScene: flights.scene,
  flyToSearchArea: flights.area,
}))
vi.mock("@/shared/motion", () => ({ motionMs: () => 2400, motionCurve: () => (x: number) => x }))
const first = { id: "first", name: "First", location: [39, 43] }
const second = { ...first, id: "second" }
const journey: SearchJourney = {
  request: 1,
  sending: true,
  status: "checking",
  location: "Sochi",
  bounds: undefined,
  candidates: [first, second],
}

function setup() {
  flights.scene.mockClear()
  const listeners = new Map<string, (event: { originalEvent?: unknown }) => void>()
  const map = {
    current: {
      stop: vi.fn(),
      on: vi.fn((name, callback) => listeners.set(name, callback)),
      off: vi.fn((name) => listeners.delete(name)),
    } as unknown as MapLibreMap,
  }
  const hook = renderHook(
    ({ scene, selected, value }) => useSearchCamera(map, true, value, selected, false, scene),
    { initialProps: { scene: first, selected: false, value: journey } },
  )
  const gesture = (name: string) => act(() => listeners.get(name)?.({ originalEvent: {} }))
  return { ...hook, gesture }
}

describe("search camera interaction", () => {
  it("continues the next flight after dragging or zooming", () => {
    const { gesture, rerender } = setup()
    gesture("dragstart")
    gesture("dragend")
    gesture("zoomstart")
    gesture("zoomend")
    rerender({ scene: second, selected: false, value: journey })
    expect(flights.scene.mock.calls.at(-1)?.[1].id).toBe("second")
  })
  it("keeps the map under the pointer until a gesture ends", () => {
    const { gesture, rerender } = setup()
    gesture("dragstart")
    rerender({ scene: second, selected: false, value: journey })
    expect(flights.scene).toHaveBeenCalledTimes(1)
    gesture("dragend")
    expect(flights.scene.mock.calls.at(-1)?.[1].id).toBe("second")
  })
  it("does not cancel the running search when a hotel is selected", () => {
    const { rerender } = setup()
    rerender({ scene: second, selected: true, value: journey })
    expect(flights.scene.mock.calls.at(-1)?.[1].id).toBe("second")
  })
})
