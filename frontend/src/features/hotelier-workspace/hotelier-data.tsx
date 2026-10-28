import { useId, useRef, useState } from "react"
import { HueIcon } from "@/entities/evidence"
import { type HotelierEntry, useHotelierEntries } from "@/entities/hotelier"
import type { Fact } from "@/shared/api/hotel-types"
import { characteristicTitle, factLabel } from "@/shared/geo/facts/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, EmptyState, ErrorState, Icon, Skeleton } from "@/shared/ui"
import { DataQuestionAction } from "./data-question-action"
import { EntryEditor } from "./entry-editor"
import { FactEditor } from "./fact-editor"
import styles from "./hotelier-data.module.css"
import type { HotelierQuestion } from "./hotelier-questions"
import { QuestionEditor } from "./question-editor"

export interface HotelierDataProps {
  readonly hotelId: string
  readonly questions: readonly HotelierQuestion[]
  readonly facts: readonly Fact[]
}

type Editing =
  | { readonly kind: "entry"; readonly id: string; readonly entry?: HotelierEntry }
  | { readonly kind: "question"; readonly question: HotelierQuestion; readonly enabled?: boolean }

export function HotelierData({ hotelId, questions, facts }: HotelierDataProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const entries = useHotelierEntries(hotelId)
  const [editing, setEditing] = useState<Editing>()
  const editorId = useId()
  const returnFocus = useRef<HTMLElement | null>(null)
  function close() {
    setEditing(undefined)
    returnFocus.current?.focus({ preventScroll: true })
  }
  function open(value: Editing, trigger: HTMLElement) {
    returnFocus.current = trigger
    setEditing(value)
  }
  const activeFact = (q: HotelierQuestion) =>
    facts.find((f) => f.characteristic_key === q.characteristic_key && f.status !== "superseded")
  const fact = editing?.kind === "question" ? activeFact(editing.question) : undefined
  const editor = editing ? (
    <Card id={editorId} className={styles.editor}>
      {editing.kind === "entry" ? (
        <EntryEditor
          key={editing.id}
          hotelId={hotelId}
          entryId={editing.id}
          entry={editing.entry}
          onClose={close}
        />
      ) : editing.question.status === "answered" && fact ? (
        <FactEditor
          key={fact.fact_id}
          fact={fact}
          inline
          enabled={editing.enabled}
          onClose={close}
        />
      ) : (
        <>
          <QuestionEditor
            key={editing.question.id}
            hotelId={hotelId}
            question={editing.question}
            inline
            enabled={editing.enabled}
            onSaved={close}
          />
          <Button variant="ghost" icon="chevron-left" onClick={close}>
            {t("explore:workspace.cancel")}
          </Button>
        </>
      )}
    </Card>
  ) : null
  return (
    <section className={styles.data}>
      <div className={styles.header}>
        <div>
          <Card className={styles.title} title={t("explore:workspace.dataHeading")}>
            {null}
          </Card>
          <p className={styles.intro}>{t("explore:workspace.dataIntro")}</p>
        </div>
        <Button
          icon="plus"
          aria-expanded={editing?.kind === "entry"}
          aria-controls={editorId}
          disabled={entries.isPending || entries.isError}
          onClick={(event) =>
            editing?.kind === "entry"
              ? close()
              : open({ kind: "entry", id: crypto.randomUUID() }, event.currentTarget)
          }
        >
          {t("explore:workspace.add")}
        </Button>
      </div>
      {editing?.kind === "entry" && !editing.entry ? editor : null}
      {entries.isPending ? <Skeleton lines={3} /> : null}
      {entries.isError ? (
        <ErrorState
          title={t("explore:workspace.entriesFailed")}
          onRetry={() => void entries.refetch()}
          retryPending={entries.isFetching}
        />
      ) : null}
      <Card className={styles.rows}>
        {questions.map((q) => {
          const current = activeFact(q)
          const answered = q.status === "answered"
          return (
            <fieldset
              className={styles.group}
              key={q.id}
              aria-label={characteristicTitle(q.characteristic_key, locale)}
            >
              <div className={styles.row}>
                <HueIcon characteristicKey={q.characteristic_key} />
                <div className={styles.copy}>
                  <strong>{characteristicTitle(q.characteristic_key, locale)}</strong>
                  {answered ? (
                    <p className={styles.description}>
                      {current ? factLabel(current, locale) : q.answer_text}
                    </p>
                  ) : null}
                </div>
                <DataQuestionAction
                  key={`${q.id}:${current?.fact_id ?? "new"}`}
                  hotelId={hotelId}
                  question={q}
                  fact={current}
                  expanded={editing?.kind === "question" && editing.question.id === q.id}
                  onDetails={(value, trigger) =>
                    value
                      ? open({ kind: "question", question: q, enabled: true }, trigger)
                      : close()
                  }
                  onEdit={(trigger) =>
                    editing?.kind === "question" && editing.question.id === q.id
                      ? close()
                      : open({ kind: "question", question: q }, trigger)
                  }
                />
              </div>
              {editing?.kind === "question" && editing.question.id === q.id ? editor : null}
            </fieldset>
          )
        })}
        {entries.data?.items.map((entry) => (
          <div key={entry.id} className={styles.group}>
            <div className={styles.row}>
              <Icon name="edit" />
              <div className={styles.copy}>
                <strong>{entry.title}</strong>
                <p className={styles.description}>{entry.description}</p>
              </div>
              <Button
                icon="edit"
                iconOnly
                title={t("explore:workspace.edit")}
                variant="outline"
                aria-expanded={editing?.kind === "entry" && editing.id === entry.id}
                onClick={(event) =>
                  editing?.kind === "entry" && editing.id === entry.id
                    ? close()
                    : open({ kind: "entry", id: entry.id, entry }, event.currentTarget)
                }
              >
                {t("explore:workspace.edit")}
              </Button>
            </div>
            {editing?.kind === "entry" && editing.id === entry.id ? editor : null}
          </div>
        ))}
        {!questions.length && entries.isSuccess && !entries.data.items.length ? (
          <EmptyState
            icon="edit"
            title={t("explore:workspace.noData")}
            description={t("explore:workspace.noDataText")}
          />
        ) : null}
      </Card>
    </section>
  )
}
