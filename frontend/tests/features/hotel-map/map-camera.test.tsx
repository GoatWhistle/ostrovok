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

it("keeps the camera after closing a hotel and fits a later search", () => {
  const instance = { stop: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn() }
  const map = { current: instance as unknown as MapLibreMap }
  const state = renderHook(
    ({ hotel, bounds }: { hotel: string | undefined; bounds: number[] | undefined }) =>
      useMapCamera({
        map,
        active: true,
        reduced: true,
        camera: { center: [39, 43], zoom: hotel ? 16 : 12, pitch: 30, bearing: 20 },
        bounds,
        hotelId: hotel,
        focusFeatures: [],
      }),
    {
      initialProps: { hotel: undefined, bounds: [39, 43, 40, 44] } as {
        hotel: string | undefined
        bounds: number[] | undefined
      },
    },
  )
  state.rerender({ hotel: "cosmos", bounds: undefined })
  expect(instance.jumpTo).toHaveBeenCalledTimes(2)
  state.rerender({ hotel: undefined, bounds: [39, 43, 40, 44] })
  expect(instance.jumpTo).toHaveBeenCalledTimes(2)
  expect(instance.fitBounds).toHaveBeenCalledTimes(1)
  state.rerender({ hotel: undefined, bounds: [30, 50, 31, 51] })
  expect(instance.fitBounds).toHaveBeenCalledTimes(2)
})

it("highlights hover geometry without moving the camera until explicitly selected", () => {
  const instance = { stop: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn() }
  const map = { current: instance as unknown as MapLibreMap }
  const camera = { center: [39, 43], zoom: 16, pitch: 30, bearing: 20 }
  const features = [
    {
      type: "Feature",
      properties: { kind: "route" },
      geometry: {
        type: "LineString",
        coordinates: [
          [39, 43],
          [39.01, 43.01],
        ],
      },
    },
  ]
  const state = renderHook(
    ({ previewing }) =>
      useMapCamera({
        map,
        active: true,
        reduced: true,
        camera,
        bounds: undefined,
        hotelId: "hotel-a",
        focusFeatures: features,
        previewing,
      }),
    { initialProps: { previewing: true } },
  )
  expect(instance.fitBounds).not.toHaveBeenCalled()
  state.rerender({ previewing: false })
  expect(instance.fitBounds).toHaveBeenCalledOnce()
})
