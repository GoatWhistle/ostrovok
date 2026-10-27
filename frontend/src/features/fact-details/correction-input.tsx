import { useId } from "react"
import { AnswerFields, readDraft, writeDraft } from "@/entities/catalog"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { TextField } from "@/shared/ui"
import styles from "./correction-input.module.css"
import type { useFactCorrection } from "./use-fact-correction"

export interface CorrectionInputProps {
  readonly fact: Fact
  readonly form: ReturnType<typeof useFactCorrection>
}

export function CorrectionInput({ fact, form }: CorrectionInputProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const { value, setValue, missing, mutation } = form
  if (form.structured)
    return (
      <>
        <AnswerFields
          characteristicKey={fact.characteristic_key}
          fields={form.fields}
          draft={readDraft(value)}
          onChange={(next) => setValue(writeDraft(next))}
          disabled={mutation.isPending}
          attempted={form.attempted}
          requireNumbers={form.single}
          valueLabel={t("explore:details.correction")}
          noteLabel={t("explore:answerFields.correctionNote")}
          preview={false}
        />
        {missing && !form.single ? (
          <p className={styles.error} role="alert">
            {t("explore:answerFields.missing")}
          </p>
        ) : null}
      </>
    )
  return (
    <>
      <TextField
        label={t("explore:details.correction")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={mutation.isPending}
        aria-invalid={missing || undefined}
        aria-describedby={missing ? errorId : undefined}
        required
      />
      {missing ? (
        <p id={errorId} className={styles.error} role="alert">
          {t("explore:answerFields.missing")}
        </p>
      ) : null}
    </>
  )
}
