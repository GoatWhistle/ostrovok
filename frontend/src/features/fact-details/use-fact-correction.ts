import { type FormEvent, useState } from "react"
import {
  type AnswerField,
  answerFields,
  draftFromValue,
  invalidFields,
  readDraft,
  typedValue,
  useCharacteristic,
  writeDraft,
} from "@/entities/catalog"
import { useFactMutation } from "@/entities/hotel"
import type { Fact } from "@/shared/api/hotel-types"
import { useSessionDraft } from "@/shared/hooks"

type ValueType = "bool" | "number" | "enum" | "text" | "object"

function correctionFields(fact: Fact, fields: readonly AnswerField[]): readonly AnswerField[] {
  if (typeof fact.value === "string" || fact.value === null || fact.value === undefined) return []
  if (fields.length) return fields
  if (typeof fact.value === "boolean") return [{ name: "value", kind: "bool", unit: null }]
  if (typeof fact.value === "number")
    return [{ name: "value", kind: "number", unit: fact.unit ?? null }]
  return []
}

function valueTypeOf(fact: Fact, declared: ValueType | undefined): ValueType {
  if (declared) return declared
  if (typeof fact.value === "boolean") return "bool"
  if (typeof fact.value === "number") return "number"
  return typeof fact.value === "string" ? "text" : "object"
}

export function useFactCorrection(fact: Fact) {
  const { characteristic } = useCharacteristic(fact.characteristic_key)
  const fields = correctionFields(fact, answerFields(characteristic))
  const valueType = valueTypeOf(fact, characteristic?.value_type)
  const structured = fields.length > 0
  const initial = structured
    ? writeDraft(draftFromValue(fields, fact.value))
    : typeof fact.value === "string"
      ? fact.value
      : ""
  const { value, setValue, atRisk } = useSessionDraft(`fact:${fact.fact_id}`, initial)
  const [editing, setEditing] = useState(value !== initial)
  const [attempted, setAttempted] = useState(false)
  const [missing, setMissing] = useState(false)
  const mutation = useFactMutation(fact.fact_id)
  const single = valueType !== "object"
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const done = { onSuccess: () => setEditing(false) }
    if (!structured) {
      setMissing(!value.trim())
      if (value.trim())
        mutation.mutate({ action: "correct", value: value.trim(), draft: value }, done)
      return
    }
    const draft = readDraft(value)
    const next = typedValue(valueType, fields, draft)
    setAttempted(true)
    setMissing(next === undefined)
    if (invalidFields(fields, draft, single).length || next === undefined) {
      event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()
      return
    }
    const comment = draft.note.trim()
    mutation.mutate(
      { action: "correct", value: next, ...(comment ? { comment } : {}), draft: value },
      done,
    )
  }
  return {
    structured,
    fields,
    single,
    value,
    setValue,
    atRisk,
    editing,
    setEditing,
    attempted,
    missing,
    mutation,
    submit,
  }
}
