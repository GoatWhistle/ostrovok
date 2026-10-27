const USER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const
const SETTLE_MS = 2000

export interface ScrollRestoration {
  readonly pending: () => boolean
  readonly cancel: () => void
}

const SETTLED: ScrollRestoration = { pending: () => false, cancel: () => undefined }

export function restoreScrollTop(node: HTMLElement, target: number): ScrollRestoration {
  node.scrollTop = target
  if (
    node.scrollTop >= target - 1 ||
    typeof ResizeObserver === "undefined" ||
    typeof MutationObserver === "undefined"
  )
    return SETTLED
  const apply = () => {
    node.scrollTop = target
    if (node.scrollTop >= target - 1) cancel()
  }
  const sizes = new ResizeObserver(apply)
  const children = new MutationObserver(() => {
    for (const child of node.children) sizes.observe(child)
    apply()
  })
  for (const child of node.children) sizes.observe(child)
  children.observe(node, { childList: true })
  const timer = window.setTimeout(() => cancel(), SETTLE_MS)
  let active = true
  function cancel() {
    if (!active) return
    active = false
    sizes.disconnect()
    children.disconnect()
    window.clearTimeout(timer)
    for (const type of USER_INPUT) node.removeEventListener(type, cancel)
  }
  for (const type of USER_INPUT) node.addEventListener(type, cancel, { passive: true })
  return { pending: () => active, cancel }
}
