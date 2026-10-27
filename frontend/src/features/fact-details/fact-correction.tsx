import { useEffect, useId, useRef } from "react"
import type { Fact } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { useInputModality, usePresence } from "@/shared/motion"
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
  const editorId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const editor = useRef<HTMLFormElement>(null)
  const modality = useInputModality()
  const form = useFactCorrection(fact)
  const { atRisk, editing, setEditing, mutation, submit } = form
  const presence = usePresence(editing, "--dur-exit", modality.instant)
  const wasEditing = useRef(editing)
  useEffect(() => {
    if (editing) editor.current?.querySelector<HTMLElement>("input, textarea")?.focus()
    else if (wasEditing.current && document.activeElement === document.body)
      trigger.current?.focus({ preventScroll: true })
    wasEditing.current = editing
  }, [editing])
  const collapse = () => {
    setEditing(false)
    trigger.current?.focus({ preventScroll: true })
  }
  const editable = form.structured || typeof fact.value === "string"
  return (
    <section
      className={styles.review}
      aria-labelledby={headingId}
      onKeyDown={modality.onKeyDown}
      onPointerDown={modality.onPointerDown}
    >
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
            ref={trigger}
            icon="edit"
            variant="reject"
            aria-expanded={editing}
            aria-controls={editorId}
            disabled={mutation.isPending}
            onClick={() => setEditing((current) => !current)}
          >
            {t(editing ? "explore:details.collapse" : "explore:details.wrong")}
          </Button>
        ) : null}
      </div>
      {presence.mounted ? (
        <form
          ref={editor}
          id={editorId}
          className={styles.edit}
          inert={!editing}
          data-state={presence.state}
          data-instant={modality.instant}
          onTransitionEnd={presence.onTransitionEnd}
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return
            event.preventDefault()
            event.stopPropagation()
            collapse()
          }}
        >
          <CorrectionInput fact={fact} form={form} />
          <div className={styles.actions}>
            <Button icon="send" type="submit" pending={mutation.isPending}>
              {t("explore:details.save")}
            </Button>
            <Button
              variant="ghost"
              icon="close"
              disabled={mutation.isPending}
              onClick={() => {
                form.cancel()
                trigger.current?.focus({ preventScroll: true })
              }}
            >
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
