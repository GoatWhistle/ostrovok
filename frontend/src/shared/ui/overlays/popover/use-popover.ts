import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { usePresence } from "@/shared/motion"

export function usePopover(placement: "top" | "bottom") {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [instant, setInstant] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const presence = usePresence(open, "--dur-exit", instant)

  useLayoutEffect(() => {
    if (!presence.mounted) return
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      const box = panel.current?.getBoundingClientRect()
      if (!anchor || !box) return
      const gap =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--space-8"),
        ) || 8
      const top = placement === "top" ? anchor.top - box.height - gap : anchor.bottom + gap
      setPosition({
        left: Math.max(gap, Math.min(anchor.left, innerWidth - box.width - gap)),
        top: Math.max(gap, Math.min(top, innerHeight - box.height - gap)),
      })
    }
    place()
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    if (trigger.current) observer.observe(trigger.current)
    window.addEventListener("resize", place)
    document.addEventListener("scroll", place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
      document.removeEventListener("scroll", place, true)
    }
  }, [presence.mounted, placement])

  useEffect(() => {
    if (!open) return
    panel.current?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return
      setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      event.preventDefault()
      setInstant(true)
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
    }
    const blur = (event: FocusEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", dismiss)
    document.addEventListener("focusin", blur)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", dismiss)
      document.removeEventListener("focusin", blur)
    }
  }, [open])

  return { id, trigger, panel, open, setOpen, instant, setInstant, position, presence }
}
