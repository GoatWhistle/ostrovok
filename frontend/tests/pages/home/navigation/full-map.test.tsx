import { act, renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useFullMap } from "@/pages/home/navigation/use-full-map"

it("lets a popover consume Escape before leaving the full map", () => {
  const exit = vi.fn()
  const consumed = (event: KeyboardEvent) => event.preventDefault()
  const state = renderHook(() => useFullMap(true, exit))
  document.addEventListener("keydown", consumed)
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
  })
  expect(exit).not.toHaveBeenCalled()
  document.removeEventListener("keydown", consumed)
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
  })
  expect(exit).toHaveBeenCalledOnce()
  state.unmount()
})

it("keeps the map open under a modal and restores the entry control", () => {
  const exit = vi.fn()
  const button = document.createElement("button")
  document.body.append(button)
  button.focus()
  const state = renderHook(({ full }) => useFullMap(full, exit), { initialProps: { full: true } })
  const dialog = document.createElement("dialog")
  dialog.setAttribute("open", "")
  document.body.append(dialog)
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }))
  })
  expect(exit).not.toHaveBeenCalled()
  dialog.remove()
  state.rerender({ full: false })
  expect(document.activeElement).toBe(button)
  button.remove()
})
