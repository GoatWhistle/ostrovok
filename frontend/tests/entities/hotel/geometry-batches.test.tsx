import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { useGeoFeatures } from "@/entities/hotel"
import { api } from "@/shared/api"

afterEach(() => vi.restoreAllMocks())

it("loads all geometry references in bounded batches without dropping the tail", async () => {
  const requests: string[][] = []
  vi.spyOn(api, "POST").mockImplementation(((
    _path: string,
    options: { body: { ids: string[] } },
  ) => {
    requests.push(options.body.ids)
    return Promise.resolve({
      response: new Response("{}"),
      data: {
        type: "FeatureCollection",
        features: options.body.ids.map((id) => ({
          type: "Feature",
          id,
          geometry: { type: "Point", coordinates: [39.7, 43.6] },
          properties: {},
        })),
      },
    })
  }) as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  const ids = Array.from({ length: 401 }, (_, index) => `g_${index}`)
  const { result } = renderHook(() => useGeoFeatures([...ids, "g_0"]), { wrapper: Wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(requests.map((ids) => ids.length)).toEqual([200, 200, 1])
  expect(new Set(requests.flat())).toEqual(new Set(ids))
  expect(result.current.data?.features).toHaveLength(401)
})
