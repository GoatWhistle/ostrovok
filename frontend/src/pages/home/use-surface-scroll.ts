import { useCallback, useRef } from "react"

export function useSurfaceScroll(key: string, detail: { current: HTMLDivElement | null }) {
  const positions = useRef(new Map<string, number>())
  const elements = useRef(new Map<string, HTMLDivElement>())
  return useCallback(
    (node: HTMLDivElement | null) => {
      const previous = elements.current.get(key)
      if (previous) {
        positions.current.set(key, previous.scrollTop)
        elements.current.delete(key)
        if (detail.current === previous) detail.current = null
      }
      if (!node) return
      elements.current.set(key, node)
      detail.current = node
      node.scrollTop = positions.current.get(key) ?? 0
      if (positions.current.has(key)) node.focus({ preventScroll: true })
    },
    [key, detail],
  )
}
