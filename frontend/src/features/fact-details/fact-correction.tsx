import { type FormEvent, useId, useState } from "react"
import { useFactMutation } from "@/entities/hotel"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button, Segmented, TextField } from "@/shared/ui"
import styles from "./fact-correction.module.css"

export interface FactCorrectionProps {
  readonly fact: Fact
}

export function FactCorrection({ fact }: FactCorrectionProps) {
  const { t } = useTranslation()
  const headingId = useId()
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
    <section className={styles.review} aria-labelledby={headingId}>
      <div className={styles.head}>
        <p id={headingId} className={styles.title}>
          {t("explore:details.reviewTitle")}
        </p>
        <p className={styles.text}>{t("explore:details.reviewText")}</p>
      </div>
      <div className={styles.actions}>
        <Button
          icon="check"
          variant="confirm"
          pending={mutation.isPending && !editing}
          disabled={mutation.isSuccess}
          onClick={() => mutation.mutate({ action: "confirm" })}
        >
          {t("explore:details.confirm")}
        </Button>
        {editable ? (
          <Button
            icon="edit"
            variant="reject"
            aria-expanded={editing}
            onClick={() => setEditing((current) => !current)}
          >
            {t("explore:details.wrong")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form className={styles.edit} onSubmit={submit}>
          {typeof fact.value === "boolean" ? (
            <Segmented
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
              onChange={(event) => setValue(event.target.value)}
              required
              inputMode={typeof fact.value === "number" ? "decimal" : "text"}
            />
          )}
          <div className={styles.actions}>
            <Button icon="send" type="submit" pending={mutation.isPending}>
              {t("explore:details.save")}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t("explore:details.cancel")}
            </Button>
          </div>
        </form>
      ) : null}
      {mutation.isSuccess ? <Banner tone="success" title={t("explore:details.saved")} /> : null}
      {mutation.isError ? <Banner tone="danger" title={t("explore:details.saveError")} /> : null}
    </section>
  )
}
