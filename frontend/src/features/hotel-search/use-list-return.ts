import { useCallback, useLayoutEffect, useRef } from "react"

export function useListReturn(
  scope: string,
  hotelId: string | undefined,
  count: number,
  showList = !hotelId,
) {
  const element = useRef<HTMLDivElement | null>(null)
  const positions = useRef(new Map<string, { top: number; focus: string }>())
  const restore = useCallback(() => {
    const saved = positions.current.get(scope)
    if (!showList || !saved || !element.current) return
    element.current.scrollTop = saved.top
    if (!hotelId) document.getElementById(saved.focus)?.focus({ preventScroll: true })
  }, [scope, hotelId, showList])
  const listRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node && element.current) {
        const saved = positions.current.get(scope)
        positions.current.set(scope, { top: element.current.scrollTop, focus: saved?.focus ?? "" })
      }
      element.current = node
      restore()
    },
    [restore, scope],
  )
  useLayoutEffect(() => {
    if (count) restore()
  }, [count, restore])
  function capture(id: string) {
    if (element.current)
      positions.current.set(scope, { top: element.current.scrollTop, focus: `hotel-result-${id}` })
  }
  return { listRef, capture }
}
