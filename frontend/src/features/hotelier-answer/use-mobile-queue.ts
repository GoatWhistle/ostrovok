import { useLayoutEffect, useRef, useState } from "react"
import { useMediaQuery } from "@/shared/hooks"

const NARROW = "(max-width: 63.99rem)"

export function useMobileQueue(select: (id: string) => void) {
  const narrow = useMediaQuery(NARROW)
  const [view, setView] = useState<"question" | "queue">("question")
  const [focusId, setFocusId] = useState<string>()
  const saved = useRef(0)
  const restore = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const queue = useRef<HTMLElement>(null)
  const questionScroll = useRef(0)
  const close = useRef(false)
  useLayoutEffect(() => {
    if (close.current && view === "question") {
      close.current = false
      trigger.current?.focus({ preventScroll: true })
      window.scrollTo({ top: questionScroll.current })
    }
    if (view !== "queue" || !restore.current) return
    restore.current = false
    queue.current
      ?.querySelector<HTMLElement>("button[aria-current='true'], button")
      ?.focus({ preventScroll: true })
    window.scrollTo({ top: saved.current })
  }, [view])
  return {
    narrow,
    trigger,
    queue,
    closeQueue: () => {
      saved.current = window.scrollY
      close.current = true
      setView("question")
    },
    view: narrow ? view : "both",
    focusId: narrow ? focusId : undefined,
    openQueue: () => {
      questionScroll.current = window.scrollY
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
