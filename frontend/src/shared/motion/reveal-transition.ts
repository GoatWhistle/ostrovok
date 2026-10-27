import { flushSync } from "react-dom"
import { motionMs, readEasing } from "./css-tokens"
import { prefersReducedMotion } from "./use-reduced-motion"

export type RevealKind = "theme" | "locale" | "dusk"

export interface RevealOrigin {
  readonly x: number
  readonly y: number
}

function nextFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function clipFrames(kind: RevealKind, origin: RevealOrigin | undefined): string[] {
  if (kind === "locale") return ["inset(0 0 100% 0)", "inset(0 0 0 0)"]
  const x = origin?.x ?? innerWidth
  const y = origin?.y ?? 0
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  return [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
}

export async function revealTransition(
  kind: RevealKind,
  change: () => void,
  origin?: RevealOrigin,
  instant = false,
): Promise<void> {
  const root = document.documentElement
  const finish = () => {
    delete root.dataset.switching
    delete root.dataset.viewTransition
  }
  if (instant || typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    root.dataset.switching = ""
    flushSync(change)
    await nextFrames()
    finish()
    return
  }
  root.dataset.viewTransition = kind
  const transition = document.startViewTransition(() => {
    root.dataset.switching = ""
    flushSync(change)
  })
  const limit = window.setTimeout(
    () => transition.skipTransition(),
    motionMs("--view-transition-limit"),
  )
  try {
    await transition.ready
    window.clearTimeout(limit)
    if (kind === "dusk") {
      await transition.finished
      return
    }
    root.animate(
      { clipPath: clipFrames(kind, origin) },
      {
        duration: motionMs("--dur-panel"),
        easing: readEasing("--ease-out"),
        pseudoElement: "::view-transition-new(root)",
      },
    )
    await transition.finished
  } catch {
    return
  } finally {
    window.clearTimeout(limit)
    finish()
  }
}
