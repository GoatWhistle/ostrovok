import { useCallback, useEffect, useSyncExternalStore } from "react"
import { readSessionDraft, subscribeSessionDraft, writeSessionDraft } from "./session-draft"

export function useSessionDraft(key: string, initial = "") {
  const snapshot = useCallback(() => readSessionDraft(key, initial), [key, initial])
  const draft = useSyncExternalStore(subscribeSessionDraft, snapshot)
  const setValue = useCallback((value: string) => writeSessionDraft(key, value), [key])
  const atRisk = !draft.durable && draft.value !== initial
  useEffect(() => {
    if (!atRisk) return
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", preventLoss)
    return () => window.removeEventListener("beforeunload", preventLoss)
  }, [atRisk])
  return { value: draft.value, setValue, atRisk }
}
