import { type FormEvent, useEffect, useRef, useState } from "react"
import {
  AnswerFields,
  answerFields,
  answerNeedsNote,
  binaryDraft,
  draftFromValue,
  invalidFields,
  readDraft,
  typedValue,
  useCharacteristic,
  writeDraft,
} from "@/entities/catalog"
import { useFactMutation } from "@/entities/hotel"
import type { Fact } from "@/shared/api/hotel-types"
import { characteristicTitle } from "@/shared/geo/facts/fact-label"
import { useSessionDraft } from "@/shared/hooks"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Card } from "@/shared/ui"
import styles from "./fact-editor.module.css"

export interface FactEditorProps {
  readonly inline?: boolean
  readonly enabled?: boolean | undefined
  readonly fact: Fact
  readonly onClose: () => void
}

export function FactEditor({ fact, onClose, inline = false, enabled }: FactEditorProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { characteristic } = useCharacteristic(fact.characteristic_key)
  const fields = answerFields(characteristic)
  const initial = writeDraft(draftFromValue(fields, fact.value))
  const stored = useSessionDraft(`fact:${fact.fact_id}`, initial)
  const savedDraft = binaryDraft(fields, readDraft(stored.value), enabled)
  const showNote = answerNeedsNote(characteristic?.value_type, fields, savedDraft)
  const draft = showNote ? savedDraft : { ...savedDraft, note: "" }
  const mutation = useFactMutation(fact.fact_id)
  const [attempted, setAttempted] = useState(false)
  const heading = useRef<HTMLFormElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (
      !characteristic ||
      mutation.busy ||
      invalidFields(fields, draft, characteristic.value_type !== "object").length
    )
      return
    const value = typedValue(characteristic.value_type, fields, draft)
    if (value === undefined) return
    mutation.mutate(
      { action: "correct", value, comment: draft.note, draft: stored.value },
      { onSuccess: onClose },
    )
  }
  return (
    <form ref={heading} tabIndex={-1} className={styles.form} onSubmit={submit}>
      <Card
        className={styles.content}
        title={inline ? undefined : characteristicTitle(fact.characteristic_key, locale)}
      >
        <AnswerFields
          showChoiceLabel={false}
          allowUnknown={false}
          showBoolean={!inline}
          switchChoices
          notePlaceholder={t("explore:workspace.conditionsPlaceholder")}
          characteristicKey={fact.characteristic_key}
          fields={fields}
          draft={draft}
          onChange={(value) => stored.setValue(writeDraft(value))}
          disabled={mutation.busy}
          attempted={attempted}
          requireNumbers={characteristic?.value_type !== "object"}
          showNote={showNote}
          preview={false}
        />
        {mutation.isError ? (
          <Banner tone="danger" title={t("explore:workspace.saveFailed")} />
        ) : null}
        {stored.atRisk ? <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} /> : null}
        <div className={styles.actions}>
          <Button icon="check" type="submit" pending={mutation.isPending} disabled={mutation.busy}>
            {t("explore:workspace.save")}
          </Button>
          <Button icon="chevron-left" variant="ghost" disabled={mutation.busy} onClick={onClose}>
            {t("explore:workspace.cancel")}
          </Button>
        </div>
      </Card>
    </form>
  )
}
