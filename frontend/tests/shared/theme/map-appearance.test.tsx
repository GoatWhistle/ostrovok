import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  registerMapAppearance,
  requestMapAppearance,
  useMapAppearance,
} from "@/shared/theme/map-appearance"

const cleanup: (() => void)[] = []

beforeEach(() => {
  requestMapAppearance("neon")
})

afterEach(() => {
  for (const remove of cleanup.splice(0)) remove()
  vi.restoreAllMocks()
  requestMapAppearance("neon")
})

it("rolls all maps back and preserves the selected package when one renderer fails", () => {
  const applied: string[] = []
  cleanup.push(registerMapAppearance({ applyAppearance: (id) => applied.push(id) }))
  cleanup.push(
    registerMapAppearance({
      applyAppearance: (id) => {
        if (id === "toy-town") throw new Error("Material unavailable")
      },
    }),
  )
  const { result } = renderHook(useMapAppearance)
  act(() => expect(requestMapAppearance("toy-town")).toBe(false))
  expect(result.current).toEqual({ id: "neon", failed: true })
  expect(applied).toEqual(["neon", "toy-town", "neon"])
  expect(document.documentElement.dataset.mapAppearance).toBe("neon")
})

it("keeps the latest selection and updates every attached map", () => {
  const apply = vi.fn()
  cleanup.push(registerMapAppearance({ applyAppearance: apply }))
  const { result } = renderHook(useMapAppearance)
  act(() => {
    for (let index = 0; index < 10; index += 1)
      requestMapAppearance(index % 2 ? "neon" : "toy-town")
  })
  expect(result.current.id).toBe("neon")
  expect(apply).toHaveBeenLastCalledWith("neon")
  expect(localStorage.getItem("factmap-map-appearance")).toBe("neon")
})

it("still changes the map when preference storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable")
  })
  const { result } = renderHook(useMapAppearance)
  act(() => expect(requestMapAppearance("toy-town")).toBe(true))
  expect(result.current).toEqual({ id: "toy-town", failed: false })
})

it("releases detached maps before the next change", () => {
  const apply = vi.fn()
  const remove = registerMapAppearance({ applyAppearance: apply })
  remove()
  requestMapAppearance("toy-town")
  expect(apply).toHaveBeenCalledTimes(1)
})
