import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { motionMs, usePresence } from "@/shared/motion"

export type PopoverPlacement = "top" | "bottom" | "bottom-end" | "start"

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
  anchor: Pick<DOMRect, "left" | "top" | "bottom" | "height"> & Partial<Pick<DOMRect, "right">>,
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
  const below = placement === "bottom" || placement === "bottom-end"
  const top = below ? anchor.bottom + gap : anchor.top - box.height - gap
  const left = placement === "bottom-end" ? (anchor.right ?? anchor.left) - box.width : anchor.left
  return {
    left: clamp(left, bounds.left + gap, maxLeft),
    top: clamp(top, bounds.top + gap, maxTop),
  }
}

export function usePopover(placement: PopoverPlacement) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [instant, setInstant] = useState(false)
  const leave = useRef<number | undefined>(undefined)
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
    if (!hovered) panel.current?.focus({ preventScroll: true })
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
  }, [open, hovered])

  useEffect(() => {
    if (!open) setHovered(false)
  }, [open])

  useEffect(() => () => window.clearTimeout(leave.current), [])

  const hover = {
    enter: () => {
      window.clearTimeout(leave.current)
      if (open) return
      setHovered(true)
      setOpen(true)
    },
    leave: () => {
      window.clearTimeout(leave.current)
      if (!hovered) return
      leave.current = window.setTimeout(() => setOpen(false), motionMs("--dur-fast"))
    },
    pin: () => setHovered(false),
  }

  return {
    id,
    trigger,
    panel,
    open,
    hovered,
    setOpen,
    instant,
    setInstant,
    position,
    presence,
    hover,
  }
}
