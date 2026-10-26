import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchWithRetry } from "@/shared/api/tile-retry"

function respond(...statuses: number[]) {
  const calls = statuses.map((status) => new Response(new Uint8Array([status % 256]), { status }))
  const mock = vi.fn(async () => calls.shift() ?? new Response(null, { status: 500 }))
  vi.stubGlobal("fetch", mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("terrain tile retry", () => {
  it("retries a transient server failure until the tile arrives", async () => {
    const mock = respond(500, 503, 200)
    const data = await fetchWithRetry("/tile.png", new AbortController().signal, 4, 0)
    expect(new Uint8Array(data)).toEqual(new Uint8Array([200]))
    expect(mock).toHaveBeenCalledTimes(3)
  })

  it("does not retry a missing tile", async () => {
    const mock = respond(404, 200)
    await expect(fetchWithRetry("/tile.png", new AbortController().signal, 4, 0)).rejects.toThrow(
      "404",
    )
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it("gives up after the last attempt", async () => {
    const mock = respond(500, 500, 500)
    await expect(fetchWithRetry("/tile.png", new AbortController().signal, 3, 0)).rejects.toThrow(
      "500",
    )
    expect(mock).toHaveBeenCalledTimes(3)
  })

  it("retries network errors", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }))
    vi.stubGlobal("fetch", mock)
    await fetchWithRetry("/tile.png", new AbortController().signal, 2, 0)
    expect(mock).toHaveBeenCalledTimes(2)
  })
})
