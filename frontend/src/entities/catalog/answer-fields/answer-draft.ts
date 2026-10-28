import type { components } from "@/shared/api/schema.gen"

type Characteristic = components["schemas"]["Characteristic"]
export type AnswerField = NonNullable<Characteristic["answer_fields"]>[number]
export type Choice = "yes" | "no" | "unknown"

export interface AnswerDraft {
  readonly choices: Readonly<Record<string, Choice>>
  readonly numbers: Readonly<Record<string, string>>
  readonly note: string
}

export interface AnswerPhrases {
  readonly choice: (field: AnswerField, choice: "yes" | "no") => string
  readonly number: (field: AnswerField, value: string) => string
}

export type ParsedNumber =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid" }
  | { readonly kind: "value"; readonly value: number; readonly text: string }

export type TypedValue = boolean | number | Readonly<Record<string, boolean | number>>

export const EMPTY_DRAFT: AnswerDraft = { choices: {}, numbers: {}, note: "" }

const DECIMAL = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/

export function parseNumber(text: string): ParsedNumber {
  const trimmed = text.trim()
  if (!trimmed) return { kind: "empty" }
  if (!DECIMAL.test(trimmed)) return { kind: "invalid" }
  const value = Number(trimmed.replace(",", "."))
  return Number.isFinite(value) ? { kind: "value", value, text: trimmed } : { kind: "invalid" }
}

export function choiceOf(draft: AnswerDraft, field: AnswerField): Choice {
  return draft.choices[field.name] ?? "unknown"
}

export function visibleFields(fields: readonly AnswerField[], draft: AnswerDraft) {
  const gate = fields.find((field) => field.kind === "bool")
  const open = !gate || choiceOf(draft, gate) === "yes"
  return fields.filter((field) => field.kind === "bool" || open)
}

export function invalidFields(
  fields: readonly AnswerField[],
  draft: AnswerDraft,
  requireNumbers = false,
) {
  return visibleFields(fields, draft)
    .filter((field) => field.kind === "number")
    .filter((field) => {
      const parsed = parseNumber(draft.numbers[field.name] ?? "")
      return (
        parsed.kind === "invalid" ||
        (requireNumbers && parsed.kind === "empty") ||
        (field.name === "adults" && parsed.kind === "value" && !Number.isInteger(parsed.value))
      )
    })
    .map((field) => field.name)
}

function capitalized(text: string) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

export function composeAnswer(
  fields: readonly AnswerField[],
  draft: AnswerDraft,
  phrases: AnswerPhrases,
): string {
  const parts = visibleFields(fields, draft).flatMap((field) => {
    if (field.kind === "bool") {
      const choice = choiceOf(draft, field)
      return choice === "unknown" ? [] : [phrases.choice(field, choice)]
    }
    const parsed = parseNumber(draft.numbers[field.name] ?? "")
    return parsed.kind === "value" ? [phrases.number(field, parsed.text)] : []
  })
  const note = draft.note.trim()
  const sentences = parts.map((part) => `${capitalized(part)}.`)
  return [...sentences, ...(note ? [note] : [])].join(" ")
}

export function typedValue(
  valueType: Characteristic["value_type"],
  fields: readonly AnswerField[],
  draft: AnswerDraft,
): TypedValue | undefined {
  const known: [string, boolean | number][] = visibleFields(fields, draft).flatMap(
    (field): [string, boolean | number][] => {
      if (field.kind === "bool") {
        const choice = choiceOf(draft, field)
        return choice === "unknown" ? [] : [[field.name, choice === "yes"]]
      }
      const parsed = parseNumber(draft.numbers[field.name] ?? "")
      return parsed.kind === "value" ? [[field.name, parsed.value]] : []
    },
  )
  if (valueType === "object") return known.length ? Object.fromEntries(known) : undefined
  const [first] = known
  if (!first) return undefined
  if (valueType === "bool" && typeof first[1] === "boolean") return first[1]
  if (valueType === "number" && typeof first[1] === "number") return first[1]
  return undefined
}

export function draftFromValue(fields: readonly AnswerField[], value: unknown): AnswerDraft {
  const source: Record<string, unknown> =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : Object.fromEntries(fields.slice(0, 1).map((field) => [field.name, value]))
  const choices: Record<string, Choice> = {}
  const numbers: Record<string, string> = {}
  for (const field of fields) {
    const item = source[field.name]
    if (field.kind === "bool" && typeof item === "boolean")
      choices[field.name] = item ? "yes" : "no"
    if (field.kind === "number" && typeof item === "number" && Number.isFinite(item))
      numbers[field.name] = String(item)
  }
  return { choices, numbers, note: "" }
}

function stringRecord(value: unknown, allowed?: readonly string[]) {
  if (value === null || typeof value !== "object") return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && (!allowed || allowed.includes(entry[1])),
    ),
  )
}

export function readDraft(text: string): AnswerDraft {
  if (!text) return EMPTY_DRAFT
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return { ...EMPTY_DRAFT, note: text }
    const record = parsed as Record<string, unknown>
    return {
      choices: stringRecord(record.choices, ["yes", "no", "unknown"]) as Record<string, Choice>,
      numbers: stringRecord(record.numbers),
      note: typeof record.note === "string" ? record.note : "",
    }
  } catch {
    return { ...EMPTY_DRAFT, note: text }
  }
}

export function writeDraft(draft: AnswerDraft): string {
  return JSON.stringify(draft)
}

export function binaryDraft(
  fields: readonly AnswerField[],
  draft: AnswerDraft,
  enabled?: boolean,
): AnswerDraft {
  const choices = { ...draft.choices }
  for (const field of fields)
    if (field.kind === "bool") {
      if (enabled !== undefined) choices[field.name] = enabled ? "yes" : "no"
      else if (choiceOf(draft, field) === "unknown") choices[field.name] = "no"
    }
  return { ...draft, choices }
}

export function answerNeedsNote(
  valueType: string | undefined,
  fields: readonly AnswerField[],
  draft: AnswerDraft,
  followUp = false,
): boolean {
  const enabled = fields.every(
    (field) => field.kind !== "bool" || draft.choices[field.name] === "yes",
  )
  return (valueType === "object" && enabled) || fields.length === 0 || followUp
}
