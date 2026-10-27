import { useCallback, useRef } from "react"
import { restoreScrollTop } from "@/shared/hooks"

export function useSurfaceScroll(key: string, detail: { current: HTMLDivElement | null }) {
  const positions = useRef(new Map<string, number>())
  const elements = useRef(new Map<string, HTMLDivElement>())
  const releases = useRef(new Map<string, () => void>())
  const restoration = useRef({ key, restored: false })
  if (restoration.current.key !== key)
    restoration.current = { key, restored: positions.current.has(key) }
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      releases.current.get(key)?.()
      releases.current.delete(key)
      const previous = elements.current.get(key)
      if (previous) {
        elements.current.delete(key)
        if (detail.current === previous) detail.current = null
      }
      if (!node) return
      const returning = positions.current.has(key)
      const target = positions.current.get(key) ?? 0
      positions.current.set(key, target)
      elements.current.set(key, node)
      detail.current = node
      const restoring = restoreScrollTop(node, target)
      const remember = () => {
        if (!restoring.pending()) positions.current.set(key, node.scrollTop)
      }
      node.addEventListener("scroll", remember, { passive: true })
      releases.current.set(key, () => {
        node.removeEventListener("scroll", remember)
        restoring.cancel()
      })
      const focused = document.activeElement
      if (returning && (focused === document.body || !focused?.getClientRects().length))
        node.focus({ preventScroll: true })
    },
    [key, detail],
  )
  return Object.assign(ref, { restored: restoration.current.restored })
}
