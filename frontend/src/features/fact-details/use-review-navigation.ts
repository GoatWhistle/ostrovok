import { useEffect, useRef, useState } from "react"

export function useReviewNavigation(hotelId: string | undefined) {
  const [selected, setSelected] = useState<{ hotel: string; fact: string; question: boolean }>()
  const detail = useRef<HTMLElement>(null)
  const origin = useRef<
    { element: HTMLElement | null; key: string | undefined; scroll: number } | undefined
  >(undefined)
  const returning = useRef(false)
  useEffect(() => {
    if (selected?.hotel === hotelId) {
      detail.current?.focus({ preventScroll: true })
      detail.current?.scrollIntoView({ block: "nearest" })
      return
    }
    if (!returning.current) return
    returning.current = false
    const saved = origin.current
    if (!saved) return
    const target = saved.element?.isConnected
      ? saved.element
      : saved.key
        ? document.querySelector<HTMLElement>(`[data-fact-trigger="${CSS.escape(saved.key)}"]`)
        : null
    target?.focus({ preventScroll: true })
    window.scrollTo({ top: saved.scroll })
  }, [selected, hotelId])
  return {
    selected,
    detail,
    open: (fact: string) => {
      if (!hotelId) return
      const active = document.activeElement
      const element = active instanceof HTMLElement ? active : null
      origin.current = { element, key: element?.dataset.factTrigger, scroll: window.scrollY }
      setSelected({
        hotel: hotelId,
        fact,
        question: Boolean(element?.closest("[data-saved-answer]")),
      })
    },
    back: () => {
      returning.current = true
      setSelected(undefined)
    },
  }
}
