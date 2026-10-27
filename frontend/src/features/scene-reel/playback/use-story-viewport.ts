import { type RefObject, useEffect, useState } from "react"

export function useStoryViewport(target: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState({ width: 0, height: 0, visible: true })
  useEffect(() => {
    const element = target.current
    if (!element) return
    let intersecting = true
    const update = () =>
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
        visible: intersecting && document.visibilityState !== "hidden",
      })
    const intersection = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false
      update()
    })
    const resize = new ResizeObserver(update)
    intersection.observe(element)
    resize.observe(element)
    document.addEventListener("visibilitychange", update)
    update()
    return () => {
      intersection.disconnect()
      resize.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [target])
  return viewport
}
