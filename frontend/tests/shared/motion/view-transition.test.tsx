import { afterEach, describe, expect, it, vi } from "vitest"
import { withViewTransition } from "@/shared/motion/with-view-transition"

function skipped() {
  const error = new DOMException("Transition was skipped", "AbortError")
  return Promise.reject(error)
}

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition")
})

describe("view transition helper", () => {
  it("applies the change and settles quietly when the browser skips the transition", async () => {
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    const change = vi.fn()
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (update: () => void) => {
        update()
        return {
          updateCallbackDone: Promise.resolve(),
          ready: skipped(),
          finished: skipped(),
          skipTransition: vi.fn(),
        }
      },
    })
    await withViewTransition("layout", change)
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off("unhandledRejection", unhandled)
    expect(change).toHaveBeenCalledTimes(1)
    expect(unhandled).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.viewTransition).toBeUndefined()
  })
})
