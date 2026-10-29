import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import type { components } from "@/shared/api/schema.gen"

type Message = components["schemas"]["ChatMessage"]

const REFRESHED = ["hotel", "hotel-details", "fact", "questions"]

export const REPLY_POLL_MS = 4000

export function backgroundReplyId(messages: readonly Message[] | undefined): string | undefined {
  const [last, before] = [...(messages ?? [])]
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        Number(b.role === "assistant") - Number(a.role === "assistant"),
    )
    .slice(0, 2)
  return last?.role === "assistant" && before?.role === "assistant" ? last.id : undefined
}

export function useBackgroundReplyRefresh(messages: readonly Message[] | undefined) {
  const cache = useQueryClient()
  const reply = backgroundReplyId(messages)
  const seen = useRef(reply)
  useEffect(() => {
    if (reply && reply !== seen.current) {
      for (const key of REFRESHED) void cache.invalidateQueries({ queryKey: [key] })
    }
    seen.current = reply
  }, [reply, cache])
}
