import { useContext, useEffect, useState } from "react"
import { KeyboardInputContext } from "./use-input-modality"
import { useReducedMotion } from "./use-reduced-motion"

export function useFirstVisit(key: string) {
  const reduced = useReducedMotion()
  const keyboard = useContext(KeyboardInputContext)
  const [first, setFirst] = useState(() => {
    try {
      return sessionStorage.getItem(key) !== "seen"
    } catch {
      return false
    }
  })
  if (first && (keyboard || reduced)) setFirst(false)
  useEffect(() => {
    try {
      sessionStorage.setItem(key, "seen")
    } catch {
      return
    }
  }, [key])
  return first && !reduced && !keyboard
}
