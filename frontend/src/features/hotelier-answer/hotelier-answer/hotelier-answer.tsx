import { useHotelierQuestions } from "@/entities/hotelier"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Segmented, Skeleton } from "@/shared/ui"
import { QuestionAnswer } from "../question-answer/question-answer"
import { QuestionQueue } from "../question-queue/question-queue"
import styles from "./hotelier-answer.module.css"
import { useMobileQueue } from "./use-mobile-queue"
import { type QueueTab, useQuestionSelection } from "./use-question-selection"

export interface HotelierAnswerProps {
  readonly hotelId: string | undefined
  readonly onEditFact: (factId: string) => void
}

type Queue = ReturnType<typeof useQuestionSelection>

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

function QueueTabs({
  queue,
  onSelect,
}: {
  readonly queue: Queue
  readonly onSelect: (id: string) => void
}) {
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
          onSelect={onSelect}
        />
      ) : (
        <TabEmpty tab={queue.tab} answered={queue.counts.answered} />
      )}
    </>
  )
}

function QueueStates({
  questions,
  queue,
}: {
  readonly questions: ReturnType<typeof useHotelierQuestions>
  readonly queue: Queue
}) {
  const { t } = useTranslation()
  const items = questions.data?.items ?? []
  return (
    <>
      {questions.isPending ? <QueueSkeleton /> : null}
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
    </>
  )
}

export function HotelierAnswer({ hotelId, onEditFact }: HotelierAnswerProps) {
  const { t } = useTranslation()
  const questions = useHotelierQuestions(hotelId)
  const items = questions.data?.items ?? []
  const queue = useQuestionSelection(items)
  const mobile = useMobileQueue(queue.select)
  const loading = hotelId !== undefined && questions.isPending
  const next = queue.next
  if (!hotelId)
    return (
      <EmptyState
        icon="hotelier"
        title={t("explore:hotelier.select")}
        description={t("explore:hotelier.description")}
      />
    )
  return (
    <div
      className={styles.workspace}
      data-view={mobile.view}
      data-empty={(questions.isSuccess && !items.length) || undefined}
    >
      <aside
        ref={mobile.queue}
        className={styles.queue}
        aria-label={t("explore:hotelier.queue")}
        onKeyDown={(event) => {
          if (!mobile.narrow || event.key !== "Escape" || event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          mobile.closeQueue()
        }}
      >
        {mobile.narrow && mobile.view === "queue" ? (
          <Button variant="ghost" icon="chevron-left" onClick={mobile.closeQueue}>
            {t("explore:hotelier.backToQuestion")}
          </Button>
        ) : null}
        {loading ? <QueueSkeleton /> : null}
        {items.length ? <QueueTabs queue={queue} onSelect={mobile.choose} /> : null}
      </aside>
      <div className={styles.main}>
        {mobile.narrow && items.length ? (
          <Button
            ref={mobile.trigger}
            variant="ghost"
            icon="list"
            className={styles.all}
            onClick={mobile.openQueue}
          >
            {t("explore:hotelier.allQuestions", { count: items.length })}
          </Button>
        ) : null}
        <QueueStates questions={questions} queue={queue} />
        {queue.selected ? (
          <QuestionAnswer
            key={queue.selected.id}
            hotelId={hotelId}
            question={queue.selected}
            focusHeading={mobile.focusId === queue.selected.id}
            onNext={next ? () => queue.select(next) : undefined}
            onEditFact={onEditFact}
          />
        ) : null}
      </div>
    </div>
  )
}
