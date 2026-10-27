import { useEffect, useLayoutEffect, useRef } from "react"

const END_MARGIN = 48

export function useChatFollow(conversationId: string | null) {
  const log = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const following = useRef(true)
  const active = useRef(conversationId)
  const positions = useRef(new Map<string | null, { top: number; following: boolean }>())
  useLayoutEffect(() => {
    const scroller = log.current
    if (!scroller || active.current === conversationId) return
    if (active.current !== null) {
      const saved = positions.current.get(conversationId)
      following.current = saved?.following ?? true
      scroller.scrollTop = saved?.top ?? scroller.scrollHeight
    }
    active.current = conversationId
  }, [conversationId])
  useEffect(() => {
    const scroller = log.current
    const content = list.current
    if (!scroller || !content) return
    const track = () => {
      following.current =
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < END_MARGIN
      positions.current.set(active.current, {
        top: scroller.scrollTop,
        following: following.current,
      })
    }
    const observer = new ResizeObserver(() => {
      if (following.current) scroller.scrollTop = scroller.scrollHeight
    })
    scroller.addEventListener("scroll", track, { passive: true })
    observer.observe(content)
    return () => {
      observer.disconnect()
      scroller.removeEventListener("scroll", track)
    }
  }, [])
  return { log, list }
}
