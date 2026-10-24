import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"
import { useHotelierQuestions } from "@/entities/hotelier"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Skeleton, TextField } from "@/shared/ui"
import styles from "./hotelier-answer.module.css"
import { QuestionAnswer } from "./question-answer"
export interface HotelierAnswerProps {
  readonly hotelId: string | undefined
}
export function HotelierAnswer({ hotelId }: HotelierAnswerProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState(hotelId ?? "")
  const questions = useHotelierQuestions(hotelId)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (value.trim()) void navigate(`/hotelier/${encodeURIComponent(value.trim())}`)
  }
  return (
    <div className={styles.workspace}>
      <form className={styles.lookup} onSubmit={submit}>
        <TextField
          label={t("explore:hotelier.hotelId")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        <Button icon="building" type="submit" disabled={!value.trim()}>
          {t("explore:hotelier.open")}
        </Button>
      </form>
      {!hotelId ? <EmptyState icon="building" title={t("explore:hotelier.select")} /> : null}
      {hotelId && questions.isPending ? <Skeleton /> : null}
      {questions.isError ? (
        <ErrorState title={t("explore:hotelier.error")} onRetry={() => void questions.refetch()} />
      ) : null}
      {questions.isSuccess &&
      !questions.data.items?.some((question) => question.status === "open") ? (
        <EmptyState icon="verified" title={t("explore:hotelier.empty")} />
      ) : null}
      {questions.data?.items
        ?.filter((question) => question.status === "open")
        .map((question) => (
          <QuestionAnswer key={question.id} question={question} />
        ))}
    </div>
  )
}
