import { useEffect, useId, useRef } from "react"
import { HueIcon } from "@/entities/evidence"
import { useHotelierAnswer, useQuestionStatus } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useSessionDraft } from "@/shared/hooks"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button } from "@/shared/ui"
import { OpenQuestion } from "./open-question"
import styles from "./question-answer.module.css"
import { SavedAnswer } from "./saved-answer"

type Question = components["schemas"]["HotelierQuestion"]

export interface QuestionAnswerProps {
  readonly hotelId: string
  readonly question: Question
  readonly focusHeading?: boolean
  readonly onNext: (() => void) | undefined
  readonly onEditFact: (factId: string) => void
}

function SkippedQuestion({
  status,
  onNext,
}: {
  readonly status: ReturnType<typeof useQuestionStatus>
  readonly onNext: (() => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.skipped}>
      <Banner tone="info" title={t("explore:hotelier.skippedTitle")}>
        {t("explore:hotelier.skippedText")}
      </Banner>
      <div className={styles.actions}>
        <Button
          icon="retry"
          pending={status.isPending}
          disabled={status.busy}
          onClick={() => status.mutate("open")}
        >
          {t("explore:hotelier.reopen")}
        </Button>
        {onNext ? (
          <Button variant="ghost" icon="next" onClick={onNext} disabled={status.busy}>
            {t("explore:hotelier.next")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function freshFacts(answer: ReturnType<typeof useHotelierAnswer>): readonly string[] {
  const result = answer.isSuccess ? answer.data : undefined
  if (!result || result.follow_up) return []
  return (result.extracted ?? []).map((fact) => fact.fact_id)
}

export function QuestionAnswer({
  hotelId,
  question,
  focusHeading = false,
  onNext,
  onEditFact,
}: QuestionAnswerProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const titleId = useId()
  const heading = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!focusHeading) return
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: "start" })
  }, [focusHeading])
  const draft = useSessionDraft(`question:${hotelId}:${question.id}`)
  const answer = useHotelierAnswer(hotelId, question.id)
  const status = useQuestionStatus(question.id)
  const fresh = freshFacts(answer)
  const linked = question.answer_fact_ids ?? []
  const view = question.status === "answered" || fresh.length ? "saved" : question.status
  const statusError =
    status.variables === "open" ? "explore:hotelier.reopenFailed" : "explore:hotelier.skipFailed"
  return (
    <section className={styles.answer} aria-labelledby={titleId} data-motion="fade">
      <p className={styles.topic}>
        <HueIcon characteristicKey={question.characteristic_key} />
        {characteristicTitle(question.characteristic_key, locale)}
      </p>
      <p ref={heading} id={titleId} className={styles.question} lang="ru" tabIndex={-1}>
        {question.text}
      </p>
      {view === "saved" ? (
        <SavedAnswer
          hotelId={hotelId}
          question={question}
          factIds={linked.length ? linked : fresh}
          conflict={Boolean(answer.data?.conflicts?.length)}
          next={onNext}
          onEditFact={onEditFact}
        />
      ) : null}
      {view === "skipped" ? <SkippedQuestion status={status} onNext={onNext} /> : null}
      {view === "open" ? (
        <OpenQuestion
          hotelId={hotelId}
          question={question}
          answer={answer}
          status={status}
          draft={draft}
          onNext={onNext}
        />
      ) : null}
      {status.isError ? <Banner tone="danger" title={t(statusError)} /> : null}
      {draft.atRisk ? <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} /> : null}
    </section>
  )
}
