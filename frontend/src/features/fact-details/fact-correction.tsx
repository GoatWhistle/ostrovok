import { type FormEvent, useState } from "react"
import { useFactMutation } from "@/entities/hotel"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, Segmented, TextField } from "@/shared/ui"
import styles from "./fact-details.module.css"
export interface FactCorrectionProps {
  readonly fact: Fact
}
export function FactCorrection({ fact }: FactCorrectionProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(typeof fact.value === "object" ? "" : String(fact.value ?? ""))
  const mutation = useFactMutation(fact.fact_id)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next =
      typeof fact.value === "number"
        ? Number(value.replace(",", "."))
        : typeof fact.value === "boolean"
          ? value === "true"
          : value
    if (typeof next === "number" && !Number.isFinite(next)) return
    mutation.mutate({ action: "correct", value: next }, { onSuccess: () => setEditing(false) })
  }
  const editable = ["string", "number", "boolean"].includes(typeof fact.value)
  return (
    <div className={styles.review}>
      <div className={styles.actions}>
        <Button
          icon="check"
          variant="secondary"
          pending={mutation.isPending}
          disabled={mutation.isSuccess}
          onClick={() => mutation.mutate({ action: "confirm" })}
        >
          {t("explore:details.confirm")}
        </Button>
        {editable ? (
          <Button icon="edit" variant="ghost" onClick={() => setEditing((current) => !current)}>
            {t("explore:details.correct")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form className={styles.edit} onSubmit={submit}>
          {typeof fact.value === "boolean" ? (
            <Segmented
              label={t("explore:details.correction")}
              options={[
                { value: "true", label: t("explore:match.full") },
                { value: "false", label: t("explore:match.none") },
              ]}
              value={value}
              onChange={setValue}
            />
          ) : (
            <TextField
              label={t("explore:details.correction")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
              inputMode={typeof fact.value === "number" ? "decimal" : "text"}
            />
          )}
          <Button icon="check" type="submit" pending={mutation.isPending}>
            {t("explore:details.save")}
          </Button>
        </form>
      ) : null}
      {mutation.isSuccess ? <p role="status">{t("explore:details.saved")}</p> : null}
      {mutation.isError ? <p role="alert">{t("explore:details.saveError")}</p> : null}
    </div>
  )
}
