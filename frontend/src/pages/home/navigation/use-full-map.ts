import { useEffect, useLayoutEffect, useRef } from "react"

export function useFullMap(full: boolean, onExit: () => void) {
  const previousFull = useRef(false)
  useEffect(() => {
    if (!full && previousFull.current) {
      const control = document.querySelector<HTMLElement>("[data-map-expand]")
      if (control?.getClientRects().length) control.focus({ preventScroll: true })
    }
    previousFull.current = full
  }, [full])
  const exit = useRef(onExit)
  exit.current = onExit
  useLayoutEffect(() => {
    if (!full) return
    const previous = document.activeElement
    const dismiss = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector("dialog[open]")
      )
        return
      event.preventDefault()
      exit.current()
    }
    window.addEventListener("keydown", dismiss)
    return () => {
      window.removeEventListener("keydown", dismiss)
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [full])
}
