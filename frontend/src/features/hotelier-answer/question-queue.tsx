import { FactTile, RowButton } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { StatusBadge, type StatusTone } from "@/shared/ui"
import styles from "./question-queue.module.css"

type Question = components["schemas"]["HotelierQuestion"]
type QuestionStatus = NonNullable<Question["status"]>

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

export function QuestionQueue({ questions, selectedId, onSelect }: QuestionQueueProps) {
  const { t } = useTranslation()
  return (
    <ul className={styles.queue}>
      {questions.map((question, index) => {
        const status = question.status ?? "open"
        const tone =
          status === "open" && question.reason === "conflict" ? "conflict" : STATE_TONE[status]
        const id = question.id ?? `question-${index}`
        return (
          <li key={id}>
            <RowButton
              className={styles.item}
              aria-current={id === selectedId ? "true" : undefined}
              disabled={!question.id}
              onClick={() => onSelect(id)}
              leadingAlign="start"
              leading={<FactTile characteristicKey={question.characteristic_key ?? ""} size="sm" />}
              trailing={
                <StatusBadge tone={tone}>{t(`explore:hotelier.state.${status}`)}</StatusBadge>
              }
            >
              <span className={styles.text} lang="ru">
                {question.text}
              </span>
              {question.reason ? (
                <span className={styles.reason}>
                  {t(`explore:hotelier.reason.${question.reason}`)}
                </span>
              ) : null}
            </RowButton>
          </li>
        )
      })}
    </ul>
  )
}
