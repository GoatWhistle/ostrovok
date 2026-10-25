import type { Map as MapLibreMap } from "maplibre-gl"

export interface OrbitView {
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly pitch: number
  readonly degreesPerSecond: number
}

export function startOrbit(map: MapLibreMap, view: OrbitView, animate: boolean): () => void {
  map.jumpTo({
    center: [view.center[0], view.center[1]],
    zoom: view.zoom,
    pitch: view.pitch,
    bearing: map.getBearing(),
  })
  if (!animate) return () => undefined
  let frame = 0
  let last = performance.now()
  const step = (now: number) => {
    const elapsed = (now - last) / 1000
    last = now
    map.setBearing((map.getBearing() + elapsed * view.degreesPerSecond) % 360)
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
