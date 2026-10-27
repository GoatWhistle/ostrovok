import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"
import { useHotelierQuestions } from "@/entities/hotelier"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Segmented, Skeleton, TextField } from "@/shared/ui"
import styles from "./hotelier-answer.module.css"
import { QuestionAnswer } from "./question-answer"
import { QuestionQueue } from "./question-queue"
import { type QueueTab, useQuestionSelection } from "./use-question-selection"

export interface HotelierAnswerProps {
  readonly hotelId: string | undefined
  readonly onEditFact: (factId: string) => void
}

const TABS: readonly QueueTab[] = ["open", "skipped", "answered"]

function QueueSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton lines={2} />
      <Skeleton lines={2} />
      <Skeleton lines={2} />
    </div>
  )
}

function LookupForm({ hotelId }: { readonly hotelId: string | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState(hotelId ?? "")
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (value.trim()) void navigate(`/hotelier/${encodeURIComponent(value.trim())}`)
  }
  return (
    <form className={styles.lookup} onSubmit={submit}>
      <TextField
        label={t("explore:hotelier.hotelId")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      />
      <Button icon="building" type="submit" variant="secondary" disabled={!value.trim()}>
        {t("explore:hotelier.open")}
      </Button>
    </form>
  )
}

function TabEmpty({ tab, answered }: { readonly tab: QueueTab; readonly answered: number }) {
  const { t } = useTranslation()
  if (tab === "skipped") return <p className={styles.empty}>{t("explore:hotelier.noSkipped")}</p>
  if (tab === "answered") return <p className={styles.empty}>{t("explore:hotelier.noAnswered")}</p>
  return (
    <p className={styles.empty}>
      {answered ? t("explore:hotelier.allAnsweredText") : t("explore:hotelier.empty")}
    </p>
  )
}

function QueueTabs({ queue }: { readonly queue: ReturnType<typeof useQuestionSelection> }) {
  const { t } = useTranslation()
  return (
    <>
      <div className={styles.tabs}>
        <Segmented
          label={t("explore:hotelier.tabsLabel")}
          value={queue.tab}
          onChange={queue.changeTab}
          options={TABS.map((tab) => ({
            value: tab,
            label: t("explore:hotelier.tabCount", {
              label: t(`explore:hotelier.tabs.${tab}`),
              count: queue.counts[tab],
            }),
          }))}
        />
      </div>
      {queue.visible.length ? (
        <QuestionQueue
          questions={queue.visible}
          selectedId={queue.selected?.id}
          onSelect={queue.select}
        />
      ) : (
        <TabEmpty tab={queue.tab} answered={queue.counts.answered} />
      )}
    </>
  )
}

export function HotelierAnswer({ hotelId, onEditFact }: HotelierAnswerProps) {
  const { t } = useTranslation()
  const questions = useHotelierQuestions(hotelId)
  const items = questions.data?.items ?? []
  const queue = useQuestionSelection(items)
  const loading = hotelId !== undefined && questions.isPending
  const next = queue.next
  return (
    <div className={styles.workspace}>
      <aside className={styles.queue} aria-label={t("explore:hotelier.queue")}>
        <LookupForm hotelId={hotelId} />
        {loading ? <QueueSkeleton /> : null}
        {items.length ? <QueueTabs queue={queue} /> : null}
      </aside>
      <div className={styles.main}>
        {hotelId ? null : (
          <EmptyState
            icon="hotelier"
            title={t("explore:hotelier.select")}
            description={t("explore:hotelier.description")}
          />
        )}
        {loading ? <QueueSkeleton /> : null}
        {questions.isError ? (
          <ErrorState
            title={t("explore:hotelier.error")}
            onRetry={() => void questions.refetch()}
            retryPending={questions.isFetching}
          />
        ) : null}
        {questions.isSuccess && !queue.counts.open && !queue.counts.skipped ? (
          <EmptyState
            icon="verified"
            title={t(items.length ? "explore:hotelier.allAnswered" : "explore:hotelier.empty")}
          />
        ) : null}
        {hotelId && queue.selected ? (
          <QuestionAnswer
            key={queue.selected.id}
            hotelId={hotelId}
            question={queue.selected}
            onNext={next ? () => queue.select(next) : undefined}
            onEditFact={onEditFact}
          />
        ) : null}
      </div>
    </div>
  )
}
