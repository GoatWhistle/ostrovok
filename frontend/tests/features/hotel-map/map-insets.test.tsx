import type { Map as MapLibreMap } from "maplibre-gl"
import { expect, it, vi } from "vitest"
import { overlayInsets, setOverlayInsets } from "@/features/hotel-map/rendering/map-insets"

it("reserves the side card on desktop and the bottom card on mobile", () => {
  expect(
    overlayInsets(new DOMRect(0, 0, 1440, 900), new DOMRect(1072, 16, 352, 550), false),
  ).toEqual({ right: 368, bottom: 0 })
  expect(overlayInsets(new DOMRect(0, 0, 375, 812), new DOMRect(16, 430, 343, 366), true)).toEqual({
    right: 0,
    bottom: 382,
  })
  expect(overlayInsets(new DOMRect(0, 0, 1440, 900), undefined, false)).toEqual({
    right: 0,
    bottom: 0,
  })
})

it("changes padding once without moving the geographical camera", () => {
  const center = { lng: 39.9, lat: 43.4 }
  const map = {
    getPadding: vi.fn(() => ({ right: 368, bottom: 0, left: 0, top: 0 })),
    getCenter: () => center,
    jumpTo: vi.fn(),
  }
  setOverlayInsets(map as unknown as MapLibreMap, 368, 0)
  expect(map.jumpTo).not.toHaveBeenCalled()
  setOverlayInsets(map as unknown as MapLibreMap, 0, 0)
  expect(map.jumpTo).toHaveBeenCalledExactlyOnceWith({
    center,
    padding: { right: 0, bottom: 0, top: 0, left: 0 },
  })
})
