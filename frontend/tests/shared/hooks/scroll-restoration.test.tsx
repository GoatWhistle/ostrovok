import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { restoreScrollTop } from "@/shared/hooks"

const observers = new Set<ResizeObserverCallback>()
const disconnect = vi.fn()

function scroller(height: number) {
  const node = document.createElement("div")
  node.append(document.createElement("section"))
  const view = { height, clientHeight: 400 }
  let top = 0
  Object.defineProperty(node, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, view.height - view.clientHeight))
    },
  })
  return { node, grow: (next: number) => (view.height = next) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        observers.add(callback)
      }
      observe() {}
      disconnect() {
        observers.delete(this.callback)
        disconnect()
      }
    },
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  disconnect.mockReset()
  observers.clear()
})

const notify = () => {
  for (const callback of [...observers]) callback([], {} as ResizeObserver)
}

describe("scroll restoration", () => {
  it("finishes at once when the content is already tall enough", () => {
    const { node } = scroller(2000)
    restoreScrollTop(node, 1200)
    expect(node.scrollTop).toBe(1200)
    expect(disconnect).not.toHaveBeenCalled()
  })

  it("reaches the saved position once late content has grown", () => {
    const { node, grow } = scroller(1366)
    restoreScrollTop(node, 1200)
    expect(node.scrollTop).toBe(966)
    grow(1500)
    notify()
    expect(node.scrollTop).toBe(1100)
    grow(1976)
    notify()
    expect(node.scrollTop).toBe(1200)
    expect(disconnect).toHaveBeenCalled()
  })

  it("lets the reader take over instead of pulling the page back", () => {
    const { node, grow } = scroller(1366)
    restoreScrollTop(node, 1200)
    node.dispatchEvent(new WheelEvent("wheel"))
    node.scrollTop = 500
    grow(1976)
    notify()
    expect(node.scrollTop).toBe(500)
  })

  it("gives up after the settle window and when cancelled", () => {
    const first = scroller(1366)
    restoreScrollTop(first.node, 1200)
    vi.advanceTimersByTime(2001)
    first.grow(1976)
    notify()
    expect(first.node.scrollTop).toBe(966)
    const second = scroller(1366)
    const restoration = restoreScrollTop(second.node, 1200)
    expect(restoration.pending()).toBe(true)
    restoration.cancel()
    expect(restoration.pending()).toBe(false)
    second.grow(1976)
    notify()
    expect(second.node.scrollTop).toBe(966)
  })
})
