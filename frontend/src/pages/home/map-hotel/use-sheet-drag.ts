import { type CSSProperties, type MouseEvent, type PointerEvent, useRef, useState } from "react"
import { withViewTransition } from "@/shared/motion"

export type SheetSnap = "peek" | "half" | "full"

const ORDER: readonly SheetSnap[] = ["peek", "half", "full"]
const THRESHOLD = 40
const SLOP = 8

export function stepSnap(snap: SheetSnap, direction: 1 | -1): SheetSnap {
  const index = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(snap) + direction))
  return ORDER[index] ?? snap
}

interface DragStart {
  readonly y: number
  readonly id: number
  moved: boolean
}

export function useSheetDrag(snap: SheetSnap, onSnap: (next: SheetSnap) => void) {
  const start = useRef<DragStart | null>(null)
  const swallow = useRef(false)
  const [offset, setOffset] = useState<number | null>(null)
  function end(event: PointerEvent<HTMLElement>) {
    const origin = start.current
    if (!origin || origin.id !== event.pointerId) return
    start.current = null
    setOffset(null)
    if (!origin.moved) return
    swallow.current = true
    const delta = event.clientY - origin.y
    if (Math.abs(delta) >= THRESHOLD) onSnap(stepSnap(snap, delta < 0 ? 1 : -1))
  }
  return {
    offset: offset ?? 0,
    dragging: offset !== null,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse") return
        const target = event.target as HTMLElement
        if (snap === "full" && !target.closest("header")) return
        start.current = { y: event.clientY, id: event.pointerId, moved: false }
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const origin = start.current
        if (!origin || origin.id !== event.pointerId) return
        const delta = event.clientY - origin.y
        if (!origin.moved && Math.abs(delta) < SLOP) return
        if (!origin.moved) {
          origin.moved = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        const limit = snap === "full" ? 0 : -THRESHOLD * 2
        setOffset(Math.max(limit, snap === "peek" ? Math.min(0, delta) : delta))
      },
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (!swallow.current) return
        swallow.current = false
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}

export function useSheet() {
  const [snap, setSnap] = useState<SheetSnap>("half")
  const move = (next: SheetSnap, instant = false) => {
    if (instant) setSnap(next)
    else void withViewTransition("layout", () => setSnap(next))
  }
  const drag = useSheetDrag(snap, move)
  const full = snap === "full"
  return {
    snap,
    drag,
    full,
    style: drag.offset ? ({ "--sheet-offset": `${drag.offset}px` } as CSSProperties) : undefined,
    toggle: (instant: boolean) => move(stepSnap(snap, full ? -1 : 1), instant),
  }
}
