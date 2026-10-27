import { type FormEvent, useId, useState } from "react"
import {
  AnswerFields,
  answerFields,
  composeAnswer,
  invalidFields,
  readDraft,
  useAnswerCopy,
  useCharacteristic,
  writeDraft,
} from "@/entities/catalog"
import { HueIcon } from "@/entities/evidence"
import { useHotelierAnswer } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useSessionDraft } from "@/shared/hooks"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Skeleton } from "@/shared/ui"
import { AnswerResult } from "./answer-result"
import { CurrentState } from "./current-state"
import styles from "./question-answer.module.css"

export interface QuestionAnswerProps {
  readonly hotelId: string
  readonly question: components["schemas"]["HotelierQuestion"]
  readonly onSkip: (() => void) | undefined
}

export function QuestionAnswer({ hotelId, question, onSkip }: QuestionAnswerProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const titleId = useId()
  const key = question.characteristic_key
  const { characteristic, pending } = useCharacteristic(key)
  const fields = answerFields(characteristic)
  const copy = useAnswerCopy(key)
  const { value: stored, setValue, atRisk } = useSessionDraft(`question:${hotelId}:${question.id}`)
  const draft = readDraft(stored)
  const [attempted, setAttempted] = useState(false)
  const answer = useHotelierAnswer(hotelId, question.id)
  const open = question.status === "open"
  const text = composeAnswer(fields, draft, copy.phrases)
  const invalid = invalidFields(fields, draft)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (answer.isPending) return
    if (invalid.length) {
      setAttempted(true)
      event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()
      return
    }
    if (!text) return
    answer.mutate({ text, draft: stored })
  }
  return (
    <section className={styles.answer} aria-labelledby={titleId} data-motion="fade">
      <p className={styles.topic}>
        <HueIcon characteristicKey={key} />
        {characteristicTitle(key, locale)}
      </p>
      <p id={titleId} className={styles.question} lang="ru">
        {question.text}
      </p>
      <p className={styles.why}>{t("explore:hotelier.why")}</p>
      {open ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          {pending ? (
            <Skeleton lines={2} />
          ) : (
            <AnswerFields
              characteristicKey={key}
              fields={fields}
              draft={draft}
              onChange={(next) => setValue(writeDraft(next))}
              disabled={answer.isPending}
              attempted={attempted}
            />
          )}
          <div className={styles.actions}>
            <Button
              type="submit"
              icon="send"
              pending={answer.isPending}
              disabled={answer.isPending || (!text && !invalid.length)}
            >
              {t("explore:hotelier.send")}
            </Button>
            {onSkip ? (
              <Button variant="ghost" icon="next" onClick={onSkip} disabled={answer.isPending}>
                {t("explore:hotelier.next")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      {atRisk ? <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} /> : null}
      <CurrentState hotelId={hotelId} characteristicKey={key} />
      {answer.isSuccess && answer.data ? <AnswerResult result={answer.data} /> : null}
      {answer.isError ? <Banner tone="danger" title={t("explore:hotelier.failed")} /> : null}
    </section>
  )
}
