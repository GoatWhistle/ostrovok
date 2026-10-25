import { type KeyboardEvent, type PointerEvent, useCallback, useState } from "react"
import { readPixels } from "../motion/css-tokens"

export type ResizeEdge = "start" | "end"

export interface ResizableOptions {
  readonly storageKey: string
  readonly edge: ResizeEdge
  readonly initial: `--${string}`
  readonly min: `--${string}`
  readonly max: `--${string}`
}

export interface Resizable {
  readonly width: number | undefined
  readonly min: number
  readonly max: number
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  readonly onDoubleClick: () => void
}

const STEP = 16

function stored(key: string): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

function remember(key: string, value: number | undefined) {
  try {
    if (value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    return
  }
}

export function useResizable({ storageKey, edge, initial, min, max }: ResizableOptions): Resizable {
  const [width, setWidth] = useState(() => stored(storageKey))
  const bounds = { min: readPixels(min), max: readPixels(max) }
  const clamp = useCallback(
    (value: number) => Math.min(readPixels(max), Math.max(readPixels(min), value)),
    [min, max],
  )
  const apply = useCallback(
    (value: number | undefined) => {
      const next = value === undefined ? undefined : clamp(value)
      setWidth(next)
      remember(storageKey, next)
    },
    [clamp, storageKey],
  )
  const direction = edge === "end" ? 1 : -1
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const panel = handle.parentElement
    const start = event.clientX
    const from = panel?.getBoundingClientRect().width ?? readPixels(initial)
    handle.setPointerCapture(event.pointerId)
    handle.dataset.dragging = "true"
    const move = (moveEvent: globalThis.PointerEvent) =>
      setWidth(clamp(from + (moveEvent.clientX - start) * direction))
    const stop = (upEvent: globalThis.PointerEvent) => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", stop)
      handle.removeEventListener("pointercancel", stop)
      delete handle.dataset.dragging
      apply(from + (upEvent.clientX - start) * direction)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop)
    handle.addEventListener("pointercancel", stop)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current = width ?? readPixels(initial)
    const keys: Readonly<Record<string, number>> = {
      ArrowLeft: current - STEP * direction,
      ArrowRight: current + STEP * direction,
      Home: bounds.min,
      End: bounds.max,
    }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    apply(next)
  }
  return { width, ...bounds, onPointerDown, onKeyDown, onDoubleClick: () => apply(undefined) }
}
