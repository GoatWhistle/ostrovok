import { describe, expect, it, vi } from "vitest"
import { RequestLane } from "../../../src/shared/api/request-lane"

describe("offer request lane", () => {
  it("bounds concurrency and removes queued work on cancellation", async () => {
    const lane = new RequestLane(3)
    const release: (() => void)[] = []
    let active = 0
    let maximum = 0
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active++
          maximum = Math.max(maximum, active)
          release.push(() => {
            active--
            resolve()
          })
        }),
    )
    const controllers = Array.from({ length: 6 }, () => new AbortController())
    const requests = controllers.map((controller) =>
      lane.run(controller.signal, work).catch((error: unknown) => error),
    )
    await vi.waitFor(() => expect(work).toHaveBeenCalledTimes(3))
    controllers[3]?.abort()
    release.splice(0).forEach((done) => {
      done()
    })
    await vi.waitFor(() => expect(work).toHaveBeenCalledTimes(5))
    release.splice(0).forEach((done) => {
      done()
    })
    const results = await Promise.all(requests)
    expect(maximum).toBe(3)
    expect(results[3]).toBeInstanceOf(DOMException)
  })
  it("releases an active slot after the HTTP request rejects on abort", async () => {
    const lane = new RequestLane(1)
    const controller = new AbortController()
    const first = lane
      .run(
        controller.signal,
        () =>
          new Promise((_, reject) =>
            controller.signal.addEventListener("abort", () => reject(controller.signal.reason)),
          ),
      )
      .catch((error: unknown) => error)
    await Promise.resolve()
    const next = vi.fn(async () => 42)
    const second = lane.run(new AbortController().signal, next)
    controller.abort()
    await first
    expect(await second).toBe(42)
    expect(next).toHaveBeenCalledOnce()
  })
})
