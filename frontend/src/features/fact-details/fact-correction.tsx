import { useId } from "react"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button } from "@/shared/ui"
import { CorrectionInput } from "./correction-input"
import styles from "./fact-correction.module.css"
import { useFactCorrection } from "./use-fact-correction"

export interface FactCorrectionProps {
  readonly fact: Fact
}

export function FactCorrection({ fact }: FactCorrectionProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const form = useFactCorrection(fact)
  const { atRisk, editing, setEditing, mutation, submit } = form
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
          disabled={mutation.isPending || mutation.isSuccess}
          onClick={() => mutation.mutate({ action: "confirm" })}
        >
          {t("explore:details.confirm")}
        </Button>
        {editable ? (
          <Button
            icon="edit"
            variant="reject"
            aria-expanded={editing}
            disabled={mutation.isPending}
            onClick={() => setEditing((current) => !current)}
          >
            {t("explore:details.wrong")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form className={styles.edit} onSubmit={submit}>
          <CorrectionInput fact={fact} form={form} />
          <div className={styles.actions}>
            <Button icon="send" type="submit" pending={mutation.isPending}>
              {t("explore:details.save")}
            </Button>
            <Button variant="ghost" disabled={mutation.isPending} onClick={() => setEditing(false)}>
              {t("explore:details.cancel")}
            </Button>
          </div>
        </form>
      ) : null}
      {atRisk ? <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} /> : null}
      {mutation.isSuccess ? <Banner tone="success" title={t("explore:details.saved")} /> : null}
      {mutation.isError ? <Banner tone="danger" title={t("explore:details.saveError")} /> : null}
    </section>
  )
}
