import { useRef, useState } from "react"
import {
  answerFields,
  binaryDraft,
  composeAnswer,
  EMPTY_DRAFT,
  useAnswerCopy,
  useCharacteristic,
} from "@/entities/catalog"
import { useFactMutation } from "@/entities/hotel"
import { useHotelierAnswer, useQuestionStatus } from "@/entities/hotelier"
import type { Fact } from "@/shared/api/hotel-types"
import { characteristicTitle } from "@/shared/geo/facts/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Switch } from "@/shared/ui"
import styles from "./data-question-action.module.css"
import type { HotelierQuestion } from "./hotelier-questions"

interface DataQuestionActionProps {
  readonly hotelId: string
  readonly question: HotelierQuestion
  readonly fact: Fact | undefined
  readonly expanded: boolean
  readonly onDetails: (enabled: boolean, trigger: HTMLElement) => void
  readonly onEdit: (trigger: HTMLButtonElement) => void
}

export function DataQuestionAction({
  hotelId,
  question,
  fact,
  expanded,
  onEdit,
  onDetails,
}: DataQuestionActionProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { characteristic, pending, failed } = useCharacteristic(question.characteristic_key)
  const copy = useAnswerCopy(question.characteristic_key)
  const answer = useHotelierAnswer(hotelId, question.id)
  const correction = useFactMutation(fact?.fact_id ?? "")
  const status = useQuestionStatus(question.id)
  const input = useRef<HTMLInputElement>(null)
  const fields = answerFields(characteristic)
  const gate = fields.find((field) => field.kind === "bool")
  const compound = characteristic?.value_type === "object" && gate !== undefined
  const [desired, setDesired] = useState<boolean>()
  const answered = question.status === "answered"
  const busy = answer.busy || correction.busy || status.busy
  const writeFailed = [answer, correction, status].some((mutation) => mutation.isError)
  const unavailable = [busy, pending, failed, answered && !fact].some(Boolean)
  const label = characteristicTitle(question.characteristic_key, locale)
  const active = compound && expanded
  const correctedValue = (value: boolean) => (compound && gate ? { [gate.name]: value } : value)
  const editLabel = t(answered ? "explore:workspace.edit" : "explore:workspace.fill")
  const edit = (
    <Button
      icon="edit"
      iconOnly
      title={editLabel}
      variant="outline"
      disabled={answered && !fact}
      aria-expanded={expanded}
      onClick={(event) => onEdit(event.currentTarget)}
    >
      {editLabel}
    </Button>
  )
  if (characteristic?.value_type !== "bool" && !compound) return edit
  function change(value: boolean) {
    if (busy) return
    if (compound && input.current) onDetails(value, input.current)
    if (compound && value) return
    setDesired(value)
    const onError = () => setDesired(undefined)
    if (answered && fact) {
      correction.mutate({ action: "correct", value: correctedValue(value) }, { onError })
      return
    }
    const draft = binaryDraft(fields, EMPTY_DRAFT, value)
    const text = composeAnswer(fields, draft, copy.phrases)
    const send = () =>
      answer.mutate(
        { text, draft: "" },
        {
          onError,
          onSuccess: (result) => {
            if (result.follow_up || !result.extracted?.length) setDesired(undefined)
          },
        },
      )
    if (question.status === "skipped") status.mutate("open", { onSuccess: send, onError })
    else send()
  }
  return (
    <div className={styles.control} aria-busy={busy || undefined}>
      <Switch
        label={label}
        inputRef={input}
        aria-expanded={compound ? expanded : undefined}
        checked={active || (desired ?? enabledValue(fact?.value, gate?.name))}
        disabled={unavailable}
        onCheckedChange={change}
      />
      {writeFailed ? <Banner tone="danger" title={t("explore:workspace.saveFailed")} /> : null}
      {answer.data?.follow_up ? (
        <>
          <Banner tone="warning" title={t("explore:workspace.followUp")}>
            {answer.data.follow_up.text}
          </Banner>
          {edit}
        </>
      ) : null}
    </div>
  )
}

function enabledValue(value: unknown, field: string | undefined): boolean {
  if (typeof value === "boolean") return value
  if (!value || typeof value !== "object" || !field) return false
  return (value as Record<string, unknown>)[field] === true
}
