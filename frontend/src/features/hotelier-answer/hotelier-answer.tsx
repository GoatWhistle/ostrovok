import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"
import { useHotelierQuestions } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Skeleton, TextField } from "@/shared/ui"
import styles from "./hotelier-answer.module.css"
import { QuestionAnswer } from "./question-answer"
import { QuestionQueue } from "./question-queue"

type Question = components["schemas"]["HotelierQuestion"]

export interface HotelierAnswerProps {
  readonly hotelId: string | undefined
}

function QueueSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton lines={2} />
      <Skeleton lines={2} />
      <Skeleton lines={2} />
    </div>
  )
}

function pick(items: readonly Question[], picked: string | undefined) {
  const open = items.filter((item) => (item.status ?? "open") === "open")
  const selected =
    items.find((item) => item.id !== undefined && item.id === picked) ?? open[0] ?? items[0]
  const next = open[(open.findIndex((item) => item.id === selected?.id) + 1) % open.length]
  return { selected, next: next && next.id !== selected?.id ? next.id : undefined }
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

export function HotelierAnswer({ hotelId }: HotelierAnswerProps) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string>()
  const questions = useHotelierQuestions(hotelId)
  const items = questions.data?.items ?? []
  const { selected, next } = pick(items, picked)
  const loading = hotelId !== undefined && questions.isPending
  return (
    <div className={styles.workspace}>
      <aside className={styles.queue} aria-label={t("explore:hotelier.queue")}>
        <LookupForm hotelId={hotelId} />
        {loading ? <QueueSkeleton /> : null}
        {items.length ? (
          <QuestionQueue questions={items} selectedId={selected?.id} onSelect={setPicked} />
        ) : null}
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
        {questions.isSuccess && !items.length ? (
          <EmptyState icon="verified" title={t("explore:hotelier.empty")} />
        ) : null}
        {hotelId && selected ? (
          <QuestionAnswer
            key={selected.id}
            hotelId={hotelId}
            question={selected}
            onSkip={next ? () => setPicked(next) : undefined}
          />
        ) : null}
      </div>
    </div>
  )
}
