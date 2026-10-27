import { useEffect } from "react"

const PROPERTY = "--visual-viewport-height"

export function useVisualViewportHeight(active: boolean) {
  useEffect(() => {
    const viewport = globalThis.visualViewport
    if (!active || !viewport) return
    const root = document.documentElement
    const update = () => root.style.setProperty(PROPERTY, `${Math.round(viewport.height)}px`)
    update()
    viewport.addEventListener("resize", update)
    return () => {
      viewport.removeEventListener("resize", update)
      root.style.removeProperty(PROPERTY)
    }
  }, [active])
}
