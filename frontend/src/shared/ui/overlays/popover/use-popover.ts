import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { usePresence } from "@/shared/motion"

export type PopoverPlacement = "top" | "bottom" | "start"

export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

function boundsOf(element: Element | null | undefined): Bounds {
  const area = element?.closest("[data-popover-boundary]")?.getBoundingClientRect()
  return {
    left: Math.max(0, area?.left ?? 0),
    top: Math.max(0, area?.top ?? 0),
    right: Math.min(innerWidth, area?.right ?? innerWidth),
    bottom: Math.min(innerHeight, area?.bottom ?? innerHeight),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

export function placePanel(
  anchor: Pick<DOMRect, "left" | "top" | "bottom" | "height">,
  box: { readonly width: number; readonly height: number },
  placement: PopoverPlacement,
  bounds: Bounds,
  gap: number,
) {
  const maxLeft = bounds.right - box.width - gap
  const maxTop = bounds.bottom - box.height - gap
  const beside = anchor.left - box.width - gap
  if (placement === "start" && beside >= bounds.left + gap) {
    const middle = anchor.top + anchor.height / 2 - box.height / 2
    return { left: beside, top: clamp(middle, bounds.top + gap, maxTop) }
  }
  const top = placement === "bottom" ? anchor.bottom + gap : anchor.top - box.height - gap
  return {
    left: clamp(anchor.left, bounds.left + gap, maxLeft),
    top: clamp(top, bounds.top + gap, maxTop),
  }
}

export function usePopover(placement: PopoverPlacement) {
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
      setPosition(placePanel(anchor, box, placement, boundsOf(trigger.current), gap))
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
