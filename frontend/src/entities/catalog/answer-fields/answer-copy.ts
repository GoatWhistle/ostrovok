import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/facts/fact-label"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import type { AnswerField, AnswerPhrases } from "./answer-draft"

type Characteristic = components["schemas"]["Characteristic"]

interface ChoiceCopy {
  readonly label: MessageKey
  readonly yes: MessageKey
  readonly no: MessageKey
  readonly yesText: MessageKey
  readonly noText: MessageKey
}

interface NumberCopy {
  readonly label: MessageKey
  readonly unit: MessageKey | null
  readonly text: MessageKey
}

const CHOICES: Readonly<Record<string, ChoiceCopy>> = {
  allowed: {
    label: "explore:answerFields.allowed.label",
    yes: "explore:answerFields.allowed.yes",
    no: "explore:answerFields.allowed.no",
    yesText: "explore:answerFields.allowed.yesText",
    noText: "explore:answerFields.allowed.noText",
  },
  present: {
    label: "explore:answerFields.present.label",
    yes: "explore:answerFields.present.yes",
    no: "explore:answerFields.present.no",
    yesText: "explore:answerFields.present.yesText",
    noText: "explore:answerFields.present.noText",
  },
}

const NUMBERS: Readonly<Record<string, NumberCopy>> = {
  max_weight_kg: {
    label: "explore:answerFields.max_weight_kg.label",
    unit: "explore:answerFields.max_weight_kg.unit",
    text: "explore:answerFields.max_weight_kg.text",
  },
  fee_rub: {
    label: "explore:answerFields.fee_rub.label",
    unit: "explore:answerFields.fee_rub.unit",
    text: "explore:answerFields.fee_rub.text",
  },
  adults: {
    label: "explore:answerFields.adults.label",
    unit: null,
    text: "explore:answerFields.adults.text",
  },
}

export function answerFields(characteristic: Characteristic | undefined): AnswerField[] {
  if (!characteristic) return []
  if (characteristic.answer_fields?.length) return [...characteristic.answer_fields]
  if (characteristic.value_type === "bool") return [{ name: "value", kind: "bool", unit: null }]
  if (characteristic.value_type === "number")
    return [{ name: "value", kind: "number", unit: characteristic.unit ?? null }]
  return []
}

export function useAnswerCopy(characteristicKey: string) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const title = characteristicTitle(characteristicKey, locale)
  const unit = (field: AnswerField) => {
    const copy = NUMBERS[field.name]
    if (copy) return copy.unit ? t(copy.unit) : undefined
    return field.unit ?? undefined
  }
  const label = (field: AnswerField) => {
    const base = CHOICES[field.name]?.label ?? NUMBERS[field.name]?.label
    return base ? t(base) : title
  }
  const option = (field: AnswerField, choice: "yes" | "no") => {
    const copy = CHOICES[field.name]
    if (copy) return t(choice === "yes" ? copy.yes : copy.no)
    return t(choice === "yes" ? "explore:answerFields.yes" : "explore:answerFields.no")
  }
  const phrases: AnswerPhrases = {
    choice: (field, choice) => {
      const copy = CHOICES[field.name]
      if (copy) return t(choice === "yes" ? copy.yesText : copy.noText)
      return t(choice === "yes" ? "explore:answerFields.yesText" : "explore:answerFields.noText")
    },
    number: (field, value) => {
      const copy = NUMBERS[field.name]
      if (copy) return t(copy.text, { value })
      const suffix = unit(field)
      return suffix ? t("explore:answerFields.number", { value, unit: suffix }) : value
    },
  }
  const numberLabel = (field: AnswerField) => {
    const suffix = unit(field)
    return suffix
      ? t("explore:answerFields.numberLabel", { label: label(field), unit: suffix })
      : label(field)
  }
  return { label, numberLabel, option, phrases }
}
