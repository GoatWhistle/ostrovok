import { useId, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { NumberField, Segmented, Switch, TextArea } from "@/shared/ui"
import { useAnswerCopy } from "./answer-copy"
import {
  type AnswerDraft,
  type AnswerField,
  type Choice,
  choiceOf,
  composeAnswer,
  invalidFields,
  visibleFields,
} from "./answer-draft"
import styles from "./answer-fields.module.css"

export interface AnswerFieldsProps {
  readonly characteristicKey: string
  readonly fields: readonly AnswerField[]
  readonly draft: AnswerDraft
  readonly onChange: (draft: AnswerDraft) => void
  readonly disabled?: boolean
  readonly attempted?: boolean
  readonly noteLabel?: string
  readonly valueLabel?: string
  readonly requireNumbers?: boolean
  readonly notePlaceholder?: string
  readonly switchChoices?: boolean
  readonly allowUnknown?: boolean
  readonly showBoolean?: boolean
  readonly showChoiceLabel?: boolean
  readonly showNote?: boolean
  readonly preview?: boolean
}

function NumberInput({
  field,
  label,
  value,
  invalid,
  disabled,
  onChange,
  onBlur,
}: {
  readonly field: AnswerField
  readonly label: string
  readonly value: string
  readonly invalid: boolean
  readonly disabled: boolean
  readonly onChange: (value: string) => void
  readonly onBlur: () => void
}) {
  const { t } = useTranslation()
  const errorId = useId()
  return (
    <div className={styles.number}>
      <NumberField
        label={label}
        value={value}
        integer={field.name === "adults"}
        decreaseLabel={t("explore:answerFields.decrease", { label })}
        increaseLabel={t("explore:answerFields.increase", { label })}
        autoComplete="off"
        disabled={disabled}
        data-answer-field={field.name}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onValueChange={onChange}
        onBlur={onBlur}
      />
      {invalid ? (
        <p id={errorId} className={styles.error} role="alert">
          {t(
            field.name === "adults"
              ? "explore:answerFields.invalidCount"
              : "explore:answerFields.invalidNumber",
          )}
        </p>
      ) : null}
    </div>
  )
}

export function AnswerFields({
  characteristicKey,
  fields,
  draft,
  onChange,
  disabled = false,
  attempted = false,
  noteLabel,
  valueLabel,
  requireNumbers = false,
  notePlaceholder,
  switchChoices = false,
  allowUnknown = true,
  showBoolean = true,
  showChoiceLabel = true,
  showNote = true,
  preview = true,
}: AnswerFieldsProps) {
  const { t } = useTranslation()
  const copy = useAnswerCopy(characteristicKey)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const invalid = new Set(invalidFields(fields, draft, requireNumbers && attempted))
  const label = (field: AnswerField) =>
    field.name === "value" && valueLabel ? valueLabel : copy.label(field)
  const numberLabel = (field: AnswerField) =>
    field.name === "value" && valueLabel ? valueLabel : copy.numberLabel(field)
  const composed = composeAnswer(fields, draft, copy.phrases)
  const choose = (field: AnswerField, choice: Choice) =>
    onChange({ ...draft, choices: { ...draft.choices, [field.name]: choice } })
  const type = (field: AnswerField, value: string) =>
    onChange({ ...draft, numbers: { ...draft.numbers, [field.name]: value } })
  return (
    <div className={styles.fields}>
      {visibleFields(fields, draft)
        .filter((field) => showBoolean || field.kind !== "bool")
        .map((field) =>
          field.kind === "bool" ? (
            <div key={field.name} className={styles.choice}>
              <span
                className={showChoiceLabel ? styles.label : "visually-hidden"}
                aria-hidden="true"
              >
                {label(field)}
              </span>
              {switchChoices ? (
                <Switch
                  label={label(field)}
                  checked={choiceOf(draft, field) === "yes"}
                  disabled={disabled}
                  onCheckedChange={(checked) => choose(field, checked ? "yes" : "no")}
                />
              ) : (
                <Segmented
                  label={label(field)}
                  disabled={disabled}
                  value={choiceOf(draft, field)}
                  onChange={(choice) => choose(field, choice)}
                  options={[
                    {
                      value: "yes",
                      label: copy.option(field, "yes"),
                      icon: "check",
                    },
                    {
                      value: "no",
                      label: copy.option(field, "no"),
                      icon: "rejected",
                    },
                    ...(allowUnknown
                      ? [{ value: "unknown" as const, label: t("explore:answerFields.unknown") }]
                      : []),
                  ]}
                />
              )}
            </div>
          ) : (
            <NumberInput
              key={field.name}
              field={field}
              label={numberLabel(field)}
              value={draft.numbers[field.name] ?? ""}
              invalid={invalid.has(field.name) && (attempted || touched.has(field.name))}
              disabled={disabled}
              onChange={(value) => type(field, value)}
              onBlur={() => setTouched((current) => new Set(current).add(field.name))}
            />
          ),
        )}
      {showNote ? (
        <TextArea
          label={noteLabel ?? t("explore:answerFields.note")}
          placeholder={notePlaceholder ?? t("explore:answerFields.notePlaceholder")}
          value={draft.note}
          maxLength={10000}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
        />
      ) : null}
      {preview ? (
        <div className={styles.preview} aria-live="polite">
          <p className={styles.previewLabel}>{t("explore:answerFields.preview")}</p>
          <p className={composed ? styles.previewText : styles.previewEmpty}>
            {composed || t("explore:answerFields.previewEmpty")}
          </p>
        </div>
      ) : null}
    </div>
  )
}
