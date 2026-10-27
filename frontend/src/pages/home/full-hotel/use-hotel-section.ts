import { useEffect, useRef } from "react"

export function useHotelSection(
  hotel: string | undefined,
  section: string | undefined,
  restoreScroll = false,
) {
  const page = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = page.current
    if (restoreScroll || !element || !hotel || !["offers", "rooms"].includes(section ?? "")) return
    const reveal = () => {
      const target = document.getElementById(`${hotel}-rooms`)
      if (!target || !element.contains(target)) return false
      target.scrollIntoView({ block: "start" })
      target.focus({ preventScroll: true })
      return true
    }
    if (reveal()) return
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect()
    })
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [hotel, section, restoreScroll])
  return page
}
