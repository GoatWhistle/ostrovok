import { createContext, useCallback, useEffect, useState } from "react"

export const KeyboardInputContext = createContext(false)

export interface InputModality {
  readonly instant: boolean
  readonly onKeyDown: () => void
  readonly onPointerDown: () => void
}

export function useInputModality(trackDocument = false): InputModality {
  const [instant, setInstant] = useState(false)
  const onKeyDown = useCallback(() => setInstant(true), [])
  const onPointerDown = useCallback(() => setInstant(false), [])
  useEffect(() => {
    if (!trackDocument) return
    document.addEventListener("keydown", onKeyDown, true)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown, true)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [trackDocument, onKeyDown, onPointerDown])
  return { instant, onKeyDown, onPointerDown }
}
