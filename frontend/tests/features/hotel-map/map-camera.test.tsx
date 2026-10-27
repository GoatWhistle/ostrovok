import { renderHook } from "@testing-library/react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { expect, it, vi } from "vitest"
import { useMapCamera } from "@/features/hotel-map/rendering/use-map-camera"

it("preserves a manually moved camera across hidden and visible cycles", () => {
  const instance = { stop: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn() }
  const map = { current: instance as unknown as MapLibreMap }
  const camera = { center: [39, 43], zoom: 14, pitch: 45, bearing: 0 }
  const state = renderHook(
    ({ active, zoom }) =>
      useMapCamera({
        map,
        active,
        reduced: true,
        camera: { ...camera, zoom },
        bounds: undefined,
        hotelId: undefined,
        focusFeatures: [],
      }),
    { initialProps: { active: true, zoom: 14 } },
  )
  expect(instance.jumpTo).toHaveBeenCalledTimes(1)
  for (let index = 0; index < 10; index += 1) {
    state.rerender({ active: false, zoom: 14 })
    state.rerender({ active: true, zoom: 14 })
  }
  expect(instance.jumpTo).toHaveBeenCalledTimes(1)
  expect(instance.stop).toHaveBeenCalledTimes(1)
  state.rerender({ active: false, zoom: 16 })
  expect(instance.jumpTo).toHaveBeenCalledTimes(1)
  state.rerender({ active: true, zoom: 16 })
  expect(instance.jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 16 }))
  expect(instance.jumpTo).toHaveBeenCalledTimes(2)
})
