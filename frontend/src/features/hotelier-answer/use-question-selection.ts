import { useEffect, useRef, useState } from "react"
import type { components } from "@/shared/api/schema.gen"

type Question = components["schemas"]["HotelierQuestion"]
export type QueueTab = Question["status"]

export function useQuestionSelection(items: readonly Question[]) {
  const [tab, setTab] = useState<QueueTab>("open")
  const [selectedId, setSelectedId] = useState<string>()
  const visible = items.filter((item) => item.status === tab)
  const chosen = items.find((item) => item.id === selectedId)
  const fallback = chosen
    ? undefined
    : (visible[0] ?? items.find((item) => item.status === "open") ?? items[0])
  const fallbackId = fallback?.id
  useEffect(() => {
    if (fallbackId) setSelectedId(fallbackId)
  }, [fallbackId])
  const selected = chosen ?? fallback
  const previous = useRef({ id: selected?.id, status: selected?.status })
  const id = selected?.id
  const status = selected?.status
  useEffect(() => {
    const before = previous.current
    if (before.id === id && before.status === "skipped" && status === "open") setTab("open")
    previous.current = { id, status }
  }, [id, status])
  const position = items.findIndex((item) => item.id === selected?.id)
  const next =
    items.slice(position + 1).find((item) => item.status === "open") ??
    items.slice(0, Math.max(position, 0)).find((item) => item.status === "open")
  const counts: Record<QueueTab, number> = {
    open: items.filter((item) => item.status === "open").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    answered: items.filter((item) => item.status === "answered").length,
  }
  function changeTab(value: QueueTab) {
    setTab(value)
    const first = items.find((item) => item.status === value)
    if (first && selected?.status !== value) setSelectedId(first.id)
  }
  return {
    tab,
    changeTab,
    visible,
    selected,
    select: setSelectedId,
    next: next?.id,
    counts,
  }
}
