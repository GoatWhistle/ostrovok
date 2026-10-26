import { type FormEvent, useState } from "react"
import { useFactMutation } from "@/entities/hotel"
import type { Fact } from "@/shared/api/hotel-types"
import { useSessionDraft } from "@/shared/hooks"

export function useFactCorrection(fact: Fact) {
  const initial = typeof fact.value === "object" ? "" : String(fact.value ?? "")
  const { value, setValue, atRisk } = useSessionDraft(`fact:${fact.fact_id}`, initial)
  const [editing, setEditing] = useState(value !== initial)
  const [invalid, setInvalid] = useState(false)
  const mutation = useFactMutation(fact.fact_id)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    if (
      typeof fact.value === "number" &&
      !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim())
    ) {
      setInvalid(true)
      return
    }
    const next =
      typeof fact.value === "number"
        ? Number(value.replace(",", "."))
        : typeof fact.value === "boolean"
          ? value === "true"
          : value
    if (typeof next === "number" && (!Number.isFinite(next) || next < 0)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    mutation.mutate(
      { action: "correct", value: next, draft: value },
      { onSuccess: () => setEditing(false) },
    )
  }
  return { value, setValue, atRisk, editing, setEditing, invalid, setInvalid, mutation, submit }
}
