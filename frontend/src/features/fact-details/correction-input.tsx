import { useId } from "react"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Segmented, TextField } from "@/shared/ui"
import styles from "./correction-input.module.css"
import type { useFactCorrection } from "./use-fact-correction"

export interface CorrectionInputProps {
  readonly fact: Fact
  readonly form: ReturnType<typeof useFactCorrection>
}

export function CorrectionInput({ fact, form }: CorrectionInputProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const { value, setValue, invalid, setInvalid, mutation } = form
  return (
    <>
      {typeof fact.value === "boolean" ? (
        <Segmented
          disabled={mutation.isPending}
          label={t("explore:details.correction")}
          options={[
            { value: "true", label: t("explore:match.full"), icon: "check" },
            { value: "false", label: t("explore:match.none"), icon: "rejected" },
          ]}
          value={value}
          onChange={setValue}
        />
      ) : (
        <TextField
          label={t("explore:details.correction")}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setInvalid(false)
          }}
          disabled={mutation.isPending}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          required
          inputMode={typeof fact.value === "number" ? "decimal" : "text"}
        />
      )}
      {invalid ? (
        <p id={errorId} className={styles.error} role="alert">
          {t("explore:details.invalidNumber")}
        </p>
      ) : null}
    </>
  )
}
