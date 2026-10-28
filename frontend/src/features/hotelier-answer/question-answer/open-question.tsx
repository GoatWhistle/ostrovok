import { type FormEvent, useState } from "react"
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
import type { useHotelierAnswer, useQuestionStatus } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button, Skeleton } from "@/shared/ui"
import { FollowUp } from "./answer-result"
import { CurrentState } from "./current-state"
import styles from "./question-answer.module.css"

export interface OpenQuestionProps {
  readonly hotelId: string
  readonly question: components["schemas"]["HotelierQuestion"]
  readonly answer: ReturnType<typeof useHotelierAnswer>
  readonly status: ReturnType<typeof useQuestionStatus>
  readonly draft: { readonly value: string; readonly setValue: (value: string) => void }
  readonly onNext: (() => void) | undefined
}

export function OpenQuestion({
  hotelId,
  question,
  answer,
  status,
  draft: stored,
  onNext,
}: OpenQuestionProps) {
  const { t } = useTranslation()
  const key = question.characteristic_key
  const { characteristic, pending } = useCharacteristic(key)
  const fields = answerFields(characteristic)
  const copy = useAnswerCopy(key)
  const draft = readDraft(stored.value)
  const [attempted, setAttempted] = useState(false)
  const text = composeAnswer(fields, draft, copy.phrases)
  const invalid = invalidFields(fields, draft)
  const followUp = answer.isSuccess ? answer.data?.follow_up : undefined
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (answer.busy) return
    if (invalid.length) {
      setAttempted(true)
      event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()
      return
    }
    if (text) answer.mutate({ text, draft: stored.value })
  }
  return (
    <>
      <p className={styles.why}>{t("explore:hotelier.why")}</p>
      {followUp ? <FollowUp question={followUp.text} sent={answer.variables?.text} /> : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        {pending ? (
          <Skeleton lines={2} />
        ) : (
          <AnswerFields
            characteristicKey={key}
            fields={fields}
            draft={draft}
            onChange={(next) => stored.setValue(writeDraft(next))}
            disabled={answer.busy}
            attempted={attempted}
          />
        )}
        <div className={styles.actions}>
          <Button
            type="submit"
            icon="send"
            pending={answer.isPending}
            disabled={answer.busy || (!text && !invalid.length)}
          >
            {t("explore:hotelier.send")}
          </Button>
          <Button
            variant="secondary"
            icon="pause"
            pending={status.isPending}
            disabled={status.busy}
            onClick={() => status.mutate("skipped")}
          >
            {t("explore:hotelier.skip")}
          </Button>
          {onNext ? (
            <Button variant="ghost" icon="next" onClick={onNext} disabled={answer.busy}>
              {t("explore:hotelier.next")}
            </Button>
          ) : null}
        </div>
      </form>
      {answer.isError ? <Banner tone="danger" title={t("explore:hotelier.failed")} /> : null}
      <CurrentState hotelId={hotelId} characteristicKey={key} />
    </>
  )
}
