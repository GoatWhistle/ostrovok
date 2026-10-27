import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { clearSessionDraft } from "@/shared/hooks/session-draft"
import { useSessionDraft } from "@/shared/hooks/use-session-draft"

describe("session draft safety", () => {
  it("keeps a newer edit when an older request completes", () => {
    const draft = renderHook(() => useSessionDraft("newer-edit"))
    act(() => draft.result.current.setValue("submitted"))
    act(() => draft.result.current.setValue("newer"))
    act(() => clearSessionDraft("newer-edit", "submitted"))
    expect(draft.result.current.value).toBe("newer")
    act(() => clearSessionDraft("newer-edit", "newer"))
    expect(draft.result.current.value).toBe("")
  })

  it("uses an updated server value when no local correction remains", () => {
    const draft = renderHook(({ initial }) => useSessionDraft("server-update", initial), {
      initialProps: { initial: "12" },
    })
    draft.rerender({ initial: "15" })
    expect(draft.result.current.value).toBe("15")
    act(() => draft.result.current.setValue("17"))
    draft.rerender({ initial: "18" })
    expect(draft.result.current.value).toBe("17")
    act(() => clearSessionDraft("server-update", "17"))
    expect(draft.result.current.value).toBe("18")
  })

  it("warns before unloading when session storage rejects writes", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Unavailable")
    })
    const draft = renderHook(() => useSessionDraft("storage-failure"))
    act(() => draft.result.current.setValue("unsaved"))
    expect(draft.result.current.atRisk).toBe(true)
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    draft.unmount()
    const restored = renderHook(() => useSessionDraft("storage-failure"))
    expect(restored.result.current.value).toBe("unsaved")
    storage.mockRestore()
  })
})
