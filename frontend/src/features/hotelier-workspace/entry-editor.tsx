import { type FormEvent, useEffect, useRef } from "react"
import { type HotelierEntry, useSaveHotelierEntry } from "@/entities/hotelier"
import { clearSessionDraft, useSessionDraft } from "@/shared/hooks"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button, Card, TextArea, TextField } from "@/shared/ui"
import styles from "./entry-editor.module.css"

export interface EntryEditorProps {
  readonly hotelId: string
  readonly entryId: string
  readonly entry: HotelierEntry | undefined
  readonly onClose: () => void
}

export function EntryEditor({ hotelId, entryId, entry, onClose }: EntryEditorProps) {
  const { t } = useTranslation()
  const heading = useRef<HTMLFormElement>(null)
  const key = `hotelier-entry:${hotelId}:${entry?.id ?? "new"}`
  const title = useSessionDraft(`${key}:title`, entry?.title ?? "")
  const description = useSessionDraft(`${key}:description`, entry?.description ?? "")
  const stableId = useSessionDraft(`${key}:id`, entryId)
  const mutation = useSaveHotelierEntry(hotelId, stableId.value)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    stableId.setValue(stableId.value)
  }, [stableId.value, stableId.setValue])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.busy || !title.value.trim() || !description.value.trim()) return
    mutation.mutate(
      { title: title.value.trim(), description: description.value.trim() },
      {
        onSuccess: () => {
          clearSessionDraft(`${key}:id`, stableId.value)
          clearSessionDraft(`${key}:title`, title.value)
          clearSessionDraft(`${key}:description`, description.value)
          onClose()
        },
      },
    )
  }
  return (
    <form ref={heading} tabIndex={-1} className={styles.form} onSubmit={submit}>
      <Card
        className={styles.content}
        title={t(entry ? "explore:workspace.editEntry" : "explore:workspace.newEntry")}
      >
        <p>{t("explore:workspace.entryHint")}</p>
        <TextField
          label={t("explore:workspace.entryTitle")}
          required
          maxLength={80}
          placeholder={t("explore:workspace.titlePlaceholder")}
          value={title.value}
          disabled={mutation.busy}
          onChange={(event) => title.setValue(event.target.value)}
        />
        <TextArea
          label={t("explore:workspace.entryDescription")}
          required
          maxLength={1000}
          placeholder={t("explore:workspace.descriptionPlaceholder")}
          value={description.value}
          disabled={mutation.busy}
          onChange={(event) => description.setValue(event.target.value)}
        />
        {mutation.isError ? (
          <Banner tone="danger" title={t("explore:workspace.saveFailed")} />
        ) : null}
        {title.atRisk || description.atRisk ? (
          <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} />
        ) : null}
        <div className={styles.actions}>
          <Button
            type="submit"
            icon="check"
            pending={mutation.isPending}
            disabled={mutation.busy || !title.value.trim() || !description.value.trim()}
          >
            {t(entry ? "explore:workspace.save" : "explore:workspace.addEntry")}
          </Button>
          <Button variant="ghost" icon="chevron-left" disabled={mutation.busy} onClick={onClose}>
            {t("explore:workspace.cancel")}
          </Button>
        </div>
      </Card>
    </form>
  )
}
