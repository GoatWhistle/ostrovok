import { useMutationState } from "@tanstack/react-query"
import { FactTile, RowButton } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { StatusBadge, type StatusTone } from "@/shared/ui"
import styles from "./question-queue.module.css"

type Question = components["schemas"]["HotelierQuestion"]
type QuestionStatus = Question["status"]

const STATE_TONE: Readonly<Record<QuestionStatus, StatusTone>> = {
  open: "warning",
  answered: "success",
  skipped: "neutral",
}

export interface QuestionQueueProps {
  readonly questions: readonly Question[]
  readonly selectedId: string | undefined
  readonly onSelect: (id: string) => void
}

function useFailed(questionId: string) {
  const states = useMutationState({
    filters: { mutationKey: ["question-write", questionId] },
    select: (item) => item.state.status,
  })
  return states.at(-1) === "error"
}

function QueueItem({
  question,
  selected,
  onSelect,
}: {
  readonly question: Question
  readonly selected: boolean
  readonly onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const failed = useFailed(question.id)
  const tone =
    question.status === "open" && question.reason === "conflict"
      ? "conflict"
      : STATE_TONE[question.status]
  return (
    <li>
      <RowButton
        className={styles.item}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(question.id)}
        leadingAlign="start"
        leading={<FactTile characteristicKey={question.characteristic_key} size="sm" />}
        trailing={
          failed ? (
            <StatusBadge tone="danger">{t("explore:hotelier.queueError")}</StatusBadge>
          ) : (
            <StatusBadge tone={tone}>{t(`explore:hotelier.state.${question.status}`)}</StatusBadge>
          )
        }
      >
        <span className={styles.text} lang="ru">
          {question.text}
        </span>
        {question.status === "answered" ? null : (
          <span className={styles.reason}>{t(`explore:hotelier.reason.${question.reason}`)}</span>
        )}
      </RowButton>
    </li>
  )
}

export function QuestionQueue({ questions, selectedId, onSelect }: QuestionQueueProps) {
  return (
    <ul className={styles.queue}>
      {questions.map((question) => (
        <QueueItem
          key={question.id}
          question={question}
          selected={question.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}
