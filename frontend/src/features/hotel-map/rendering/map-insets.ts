import type { Map as MapLibreMap } from "maplibre-gl"

export function overlayInsets(frame: DOMRect, box: DOMRect | undefined, narrow: boolean) {
  if (!box) return { right: 0, bottom: 0 }
  return narrow
    ? { right: 0, bottom: Math.max(0, frame.bottom - box.top) }
    : { right: Math.max(0, frame.right - box.left), bottom: 0 }
}

export function setOverlayInsets(map: MapLibreMap, right: number, bottom: number) {
  const current = map.getPadding()
  if (current.right === right && current.bottom === bottom && !current.left && !current.top) return
  map.jumpTo({ center: map.getCenter(), padding: { right, bottom, top: 0, left: 0 } })
}
