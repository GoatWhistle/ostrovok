import { type FormEvent, useId, useState } from "react"
import { HueIcon } from "@/entities/evidence"
import { useHotelierAnswer } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, TextArea } from "@/shared/ui"
import { AnswerResult } from "./answer-result"
import { CurrentState } from "./current-state"
import styles from "./question-answer.module.css"

type Quick = "yes" | "no" | "text"

export interface QuestionAnswerProps {
  readonly hotelId: string
  readonly question: components["schemas"]["HotelierQuestion"]
  readonly onSkip: (() => void) | undefined
}

export function QuestionAnswer({ hotelId, question, onSkip }: QuestionAnswerProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const titleId = useId()
  const [text, setText] = useState("")
  const [sent, setSent] = useState<Quick>()
  const answer = useHotelierAnswer()
  const open = (question.status ?? "open") === "open"
  const key = question.characteristic_key
  function send(kind: Quick, value: string) {
    if (!question.id || !value.trim() || answer.isPending) return
    setSent(kind)
    answer.mutate({ questionId: question.id, text: value.trim() }, { onSuccess: () => setText("") })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send("text", text)
  }
  return (
    <section className={styles.answer} aria-labelledby={titleId} data-motion="fade">
      {key ? (
        <p className={styles.topic}>
          <HueIcon characteristicKey={key} />
          {characteristicTitle(key, locale)}
        </p>
      ) : null}
      <p id={titleId} className={styles.question} lang="ru">
        {question.text}
      </p>
      <p className={styles.why}>{t("explore:hotelier.why")}</p>
      {open ? (
        <>
          <div className={styles.actions}>
            <Button
              variant="confirm"
              icon="check"
              pending={answer.isPending && sent === "yes"}
              onClick={() => send("yes", t("explore:hotelier.yesText"))}
            >
              {t("explore:hotelier.yes")}
            </Button>
            <Button
              variant="reject"
              icon="rejected"
              pending={answer.isPending && sent === "no"}
              onClick={() => send("no", t("explore:hotelier.noText"))}
            >
              {t("explore:hotelier.no")}
            </Button>
            {onSkip ? (
              <Button variant="ghost" icon="next" onClick={onSkip}>
                {t("explore:hotelier.unknown")}
              </Button>
            ) : null}
          </div>
          <form className={styles.form} onSubmit={submit}>
            <TextArea
              label={t("explore:hotelier.detailed")}
              placeholder={t("explore:hotelier.placeholder")}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={10000}
              required
              disabled={answer.isPending}
            />
            <Button
              type="submit"
              icon="send"
              pending={answer.isPending && sent === "text"}
              disabled={!text.trim() || !question.id}
              className={styles.submit}
            >
              {t("explore:hotelier.send")}
            </Button>
          </form>
        </>
      ) : null}
      <CurrentState hotelId={hotelId} characteristicKey={key} />
      {answer.isSuccess ? <AnswerResult result={answer.data} /> : null}
      {answer.isError ? <Banner tone="danger" title={t("explore:hotelier.failed")} /> : null}
    </section>
  )
}
