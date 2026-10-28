import { type FormEvent, useState } from "react"
import {
  AnswerFields,
  answerFields,
  answerNeedsNote,
  binaryDraft,
  composeAnswer,
  invalidFields,
  readDraft,
  useAnswerCopy,
  useCharacteristic,
  writeDraft,
} from "@/entities/catalog"
import { useHotelierAnswer, useQuestionStatus } from "@/entities/hotelier"
import { useSessionDraft } from "@/shared/hooks"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button, Card, ErrorState, Skeleton } from "@/shared/ui"
import type { HotelierQuestion } from "./hotelier-questions"
import styles from "./question-editor.module.css"

export interface QuestionEditorProps {
  readonly inline?: boolean
  readonly enabled?: boolean | undefined
  readonly hotelId: string
  readonly question: HotelierQuestion
  readonly onSaved?: (() => void) | undefined
}

export function QuestionEditor({
  hotelId,
  question,
  onSaved,
  inline = false,
  enabled,
}: QuestionEditorProps) {
  const { t } = useTranslation()
  const key = question.characteristic_key
  const { characteristic, pending, failed } = useCharacteristic(key)
  const fields = answerFields(characteristic)
  const copy = useAnswerCopy(key)
  const stored = useSessionDraft(`question:${hotelId}:${question.id}`)
  const answer = useHotelierAnswer(hotelId, question.id)
  const savedDraft = binaryDraft(fields, readDraft(stored.value), enabled)
  const showNote = answerNeedsNote(
    characteristic?.value_type,
    fields,
    savedDraft,
    !!answer.data?.follow_up,
  )
  const draft = showNote ? savedDraft : { ...savedDraft, note: "" }
  const status = useQuestionStatus(question.id)
  const [attempted, setAttempted] = useState(false)
  const text = composeAnswer(fields, draft, copy.phrases)
  const busy = answer.busy || status.busy
  const writeFailed = [answer, status].some((mutation) => mutation.isError)
  const invalid = invalidFields(fields, draft, characteristic?.value_type === "number")
  const followUp = answer.isSuccess ? answer.data?.follow_up : undefined
  const titles: Record<string, string> = {
    double_room: t("explore:workspace.askDouble"),
    pets_policy: t("explore:workspace.askPets"),
    room_capacity: t("explore:workspace.askCapacity"),
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (busy || invalid.length || !text) return
    const send = () =>
      answer.mutate(
        { text, draft: stored.value },
        {
          onSuccess: (result) => {
            if (!result.follow_up && result.extracted?.length) onSaved?.()
          },
        },
      )
    if (question.status === "skipped") status.mutate("open", { onSuccess: send })
    else send()
  }
  return (
    <Card
      className={styles.editor}
      title={
        inline ? undefined : <span className={styles.heading}>{titles[key] ?? question.text}</span>
      }
    >
      {pending ? <Skeleton lines={3} /> : null}
      {failed ? <ErrorState title={t("explore:workspace.loadFailed")} /> : null}
      {followUp ? (
        <Banner tone="warning" title={t("explore:workspace.followUp")}>
          {followUp.text}
        </Banner>
      ) : null}
      {!pending && !failed ? (
        <form onSubmit={submit} className={styles.form}>
          <AnswerFields
            showChoiceLabel={false}
            allowUnknown={false}
            showBoolean={!inline}
            switchChoices
            notePlaceholder={t("explore:workspace.conditionsPlaceholder")}
            characteristicKey={key}
            fields={fields}
            draft={draft}
            onChange={(next) => stored.setValue(writeDraft(next))}
            disabled={busy}
            attempted={attempted}
            requireNumbers={characteristic?.value_type === "number"}
            showNote={showNote}
            preview={false}
          />
          <Button
            type="submit"
            icon="send"
            pending={busy}
            disabled={busy || !text || !!invalid.length}
          >
            {t(inline ? "explore:workspace.save" : "explore:workspace.saveNext")}
          </Button>
        </form>
      ) : null}
      {writeFailed ? <Banner tone="danger" title={t("explore:hotelier.failed")} /> : null}
      {stored.atRisk ? <Banner tone="warning" title={t("explore:hotelier.draftAtRisk")} /> : null}
    </Card>
  )
}
