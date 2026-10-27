import { useLayoutEffect, useRef, useState } from "react"
import { useMediaQuery } from "@/shared/hooks"

const NARROW = "(max-width: 63.99rem)"

export function useMobileQueue(select: (id: string) => void) {
  const narrow = useMediaQuery(NARROW)
  const [view, setView] = useState<"question" | "queue">("question")
  const [focusId, setFocusId] = useState<string>()
  const saved = useRef(0)
  const restore = useRef(false)
  useLayoutEffect(() => {
    if (view !== "queue" || !restore.current) return
    restore.current = false
    window.scrollTo({ top: saved.current })
  }, [view])
  return {
    narrow,
    view: narrow ? view : "both",
    focusId: narrow ? focusId : undefined,
    openQueue: () => {
      restore.current = true
      setView("queue")
    },
    choose: (id: string) => {
      select(id)
      if (!narrow) return
      saved.current = window.scrollY
      setFocusId(id)
      setView("question")
    },
  }
}
