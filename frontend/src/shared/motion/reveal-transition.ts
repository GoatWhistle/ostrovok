import { motionMs, readEasing } from "./css-tokens"
import { prefersReducedMotion } from "./use-reduced-motion"

export type RevealKind = "theme" | "locale"

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
  change: () => void | Promise<void>,
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
    await change()
    await nextFrames()
    finish()
    return
  }
  root.dataset.viewTransition = kind
  const transition = document.startViewTransition(async () => {
    root.dataset.switching = ""
    await change()
  })
  try {
    await transition.ready
    root.animate(
      { clipPath: clipFrames(kind, origin) },
      {
        duration: motionMs("--dur-reveal"),
        easing: readEasing("--ease-in-out"),
        pseudoElement: "::view-transition-new(root)",
      },
    )
    await transition.finished
  } catch {
    return
  } finally {
    finish()
  }
}
