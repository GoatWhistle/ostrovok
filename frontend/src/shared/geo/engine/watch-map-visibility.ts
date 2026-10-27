import type { Map as MapLibreMap } from "maplibre-gl"

export function watchMapVisibility(map: MapLibreMap, onChange: (active: boolean) => void) {
  const element = map.getContainer()
  let sized = element.clientWidth > 0 && element.clientHeight > 0
  let intersecting = true
  let active: boolean | undefined
  const update = (resized = false) => {
    const next = sized && intersecting && document.visibilityState !== "hidden"
    if (next !== active) {
      active = next
      if (!next) map.stop()
      onChange(next)
      if (next) map.resize()
    } else if (next && resized) map.resize()
  }
  const resize = new ResizeObserver(([entry]) => {
    sized = (entry?.contentRect.width ?? 0) > 0 && (entry?.contentRect.height ?? 0) > 0
    update(true)
  })
  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = entry?.isIntersecting ?? false
    update()
  })
  const visibility = () => update()
  resize.observe(element)
  intersection.observe(element)
  document.addEventListener("visibilitychange", visibility)
  update()
  return () => {
    resize.disconnect()
    intersection.disconnect()
    document.removeEventListener("visibilitychange", visibility)
  }
}
