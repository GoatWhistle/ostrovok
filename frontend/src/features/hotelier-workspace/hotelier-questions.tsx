import { useState } from "react"
import { HueIcon, RowButton } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/facts/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, EmptyState, Icon, ScrollArea } from "@/shared/ui"
import styles from "./hotelier-questions.module.css"
import { QuestionEditor } from "./question-editor"

export type HotelierQuestion = components["schemas"]["HotelierQuestion"]
export interface HotelierQuestionsProps {
  readonly hotelId: string
  readonly questions: readonly HotelierQuestion[]
  readonly onData: () => void
}

export function HotelierQuestions({ hotelId, questions, onData }: HotelierQuestionsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [selectedId, setSelectedId] = useState<string>()
  const selected = questions.find((q) => q.id === selectedId) ?? questions[0]
  if (!selected)
    return (
      <Card className={styles.complete}>
        <EmptyState
          icon="verified"
          title={t("explore:workspace.complete")}
          description={t("explore:workspace.completeText")}
        />
        <Button icon="edit" onClick={onData}>
          {t("explore:workspace.viewData")}
        </Button>
      </Card>
    )
  return (
    <div className={styles.workspace}>
      <Card as="aside" className={styles.queue} aria-label={t("explore:hotelier.queue")}>
        <ScrollArea>
          <ul className={styles.list}>
            {questions.map((q) => (
              <li key={q.id}>
                <RowButton
                  className={styles.item}
                  leading={<HueIcon characteristicKey={q.characteristic_key} />}
                  trailing={
                    selected.id === q.id ? <Icon name="chevron-right" size="sm" /> : undefined
                  }
                  aria-current={selected.id === q.id ? "true" : undefined}
                  onClick={() => setSelectedId(q.id)}
                >
                  {characteristicTitle(q.characteristic_key, locale)}
                </RowButton>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </Card>
      <div className={styles.editor}>
        <QuestionEditor key={selected.id} hotelId={hotelId} question={selected} />
      </div>
    </div>
  )
}
