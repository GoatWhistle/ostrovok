import { type FormEvent, useState } from "react"
import { useHotelierAnswer } from "@/entities/hotelier"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Button, Card, TextArea } from "@/shared/ui"
import styles from "./hotelier-answer.module.css"
export interface QuestionAnswerProps {
  readonly question: components["schemas"]["HotelierQuestion"]
}
export function QuestionAnswer({ question }: QuestionAnswerProps) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const answer = useHotelierAnswer()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question.id || !text.trim() || answer.isPending) return
    answer.mutate({ questionId: question.id, text: text.trim() }, { onSuccess: () => setText("") })
  }
  return (
    <Card
      title={question.text}
      description={question.reason ? t(`explore:hotelier.reason.${question.reason}`) : undefined}
    >
      <form className={styles.form} onSubmit={submit}>
        <TextArea
          label={t("explore:hotelier.answer")}
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
          pending={answer.isPending}
          disabled={!text.trim() || !question.id}
        >
          {t("explore:hotelier.send")}
        </Button>
      </form>
      {answer.isSuccess ? <p role="status">{t("explore:hotelier.saved")}</p> : null}
      {answer.isError ? <p role="alert">{t("explore:hotelier.failed")}</p> : null}
      {answer.data?.extracted?.map((fact) => (
        <p key={fact.fact_id}>{fact.label}</p>
      ))}
      {answer.data?.conflicts?.length ? <p>{t("explore:details.conflicts")}</p> : null}
      {answer.data?.follow_up?.text ? (
        <p>
          {t("explore:hotelier.followUp")}: {answer.data.follow_up.text}
        </p>
      ) : null}
    </Card>
  )
}
