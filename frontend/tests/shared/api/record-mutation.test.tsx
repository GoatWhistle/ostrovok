import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFactMutation } from "@/entities/hotel"
import { api } from "@/shared/api"

beforeEach(() => vi.restoreAllMocks())

describe("record mutations", () => {
  it("blocks competing writes across mounted observers and preserves the result on remount", async () => {
    let finish: ((value: never) => void) | undefined
    const post = vi.spyOn(api, "POST").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    const first = renderHook(() => useFactMutation("f_pending"), { wrapper: Wrapper })
    const second = renderHook(() => useFactMutation("f_pending"), { wrapper: Wrapper })
    act(() => {
      first.result.current.mutate({ action: "correct", value: 15 })
      second.result.current.mutate({ action: "confirm" })
      first.result.current.mutate({ action: "correct", value: 17 })
    })
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(second.result.current.isPending).toBe(true))
    first.unmount()
    finish?.({ data: { fact_id: "f_pending" }, response: new Response("{}") } as never)
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    second.unmount()
    const reopened = renderHook(() => useFactMutation("f_pending"), { wrapper: Wrapper })
    expect(reopened.result.current.isSuccess).toBe(true)
    expect(post).toHaveBeenCalledTimes(1)
  })
})
