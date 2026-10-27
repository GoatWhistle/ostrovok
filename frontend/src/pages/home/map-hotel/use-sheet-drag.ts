import { type CSSProperties, type PointerEvent, useRef, useState } from "react"
import { withViewTransition } from "@/shared/motion"

export type SheetSnap = "peek" | "half" | "full"

const ORDER: readonly SheetSnap[] = ["peek", "half", "full"]
const THRESHOLD = 40

export function stepSnap(snap: SheetSnap, direction: 1 | -1): SheetSnap {
  const index = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(snap) + direction))
  return ORDER[index] ?? snap
}

export function useSheetDrag(snap: SheetSnap, onSnap: (next: SheetSnap) => void) {
  const start = useRef<{ y: number; id: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const dragging = start.current !== null
  function end(event: PointerEvent<HTMLElement>) {
    const origin = start.current
    if (!origin || origin.id !== event.pointerId) return
    const delta = event.clientY - origin.y
    start.current = null
    setOffset(0)
    if (Math.abs(delta) >= THRESHOLD) onSnap(stepSnap(snap, delta < 0 ? 1 : -1))
  }
  return {
    offset,
    dragging,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return
        start.current = { y: event.clientY, id: event.pointerId }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const origin = start.current
        if (!origin || origin.id !== event.pointerId) return
        const delta = event.clientY - origin.y
        const limit = snap === "full" ? 0 : -THRESHOLD * 2
        setOffset(Math.max(limit, snap === "peek" ? Math.min(0, delta) : delta))
      },
      onPointerUp: end,
      onPointerCancel: end,
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
