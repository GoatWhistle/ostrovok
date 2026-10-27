import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { MapAppearanceControl } from "@/features/hotel-map/appearance/map-appearance-control"
import { i18n } from "@/shared/i18n"
import { registerMapAppearance, requestMapAppearance } from "@/shared/theme"

beforeEach(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  await i18n.changeLanguage("en")
})

afterEach(() => {
  requestMapAppearance("neon")
  vi.unstubAllGlobals()
})

it("retains the working choice on failure and retries the requested appearance", () => {
  let fail = true
  const remove = registerMapAppearance({
    applyAppearance: (id) => {
      if (id === "toy-town" && fail) throw new Error("Unavailable")
    },
  })
  try {
    const onChange = vi.fn()
    render(<MapAppearanceControl onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Map appearance" }))
    fireEvent.click(screen.getByRole("radio", { name: "Toy town" }))
    expect(screen.getByRole("alert").textContent).toContain("previous style is still active")
    expect(screen.getByRole("radio", { name: "Night city" })).toHaveProperty("checked", true)
    expect(onChange).not.toHaveBeenCalled()
    fail = false
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onChange).toHaveBeenCalledWith("toy-town")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("radio", { name: "Toy town" })).toHaveProperty("checked", true)
  } finally {
    remove()
  }
})

it("applies a choice when local storage rejects writes", () => {
  act(() => requestMapAppearance("neon"))
  const onChange = vi.fn()
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Unavailable")
  })
  try {
    render(<MapAppearanceControl onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Map appearance" }))
    fireEvent.click(screen.getByRole("radio", { name: "Toy town" }))
    expect(onChange).toHaveBeenCalledWith("toy-town")
  } finally {
    storage.mockRestore()
  }
})
