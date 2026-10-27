import { FactStatusBadge } from "@/entities/evidence"
import { useFact } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { factLabel } from "@/shared/geo/fact-label"
import { useFormatters, useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Skeleton } from "@/shared/ui"
import styles from "./saved-answer.module.css"

type Fact = components["schemas"]["Fact"]
type Question = components["schemas"]["HotelierQuestion"]

function currentVersion(detail: components["schemas"]["FactDetail"]): Fact | undefined {
  return [detail, ...(detail.history ?? [])]
    .filter((item) => item.status !== "superseded")
    .sort((a, b) =>
      (b.provenance?.computed_at ?? "").localeCompare(a.provenance?.computed_at ?? ""),
    )[0]
}

function LinkedFact({
  hotelId,
  factId,
  onEdit,
}: {
  readonly hotelId: string
  readonly factId: string
  readonly onEdit: (factId: string) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const detail = useFact(hotelId, factId)
  if (detail.isPending) return <Skeleton lines={1} />
  if (detail.isError)
    return (
      <Banner tone="danger" title={t("explore:hotelier.factFailed")}>
        <Button size="compact" variant="ghost" icon="retry" onClick={() => void detail.refetch()}>
          {t("common:action.retry")}
        </Button>
      </Banner>
    )
  const current = currentVersion(detail.data)
  if (!current) return null
  return (
    <div className={styles.fact}>
      <p className={styles.value}>{factLabel(current, locale)}</p>
      <FactStatusBadge status={current.status} />
      <Button
        size="compact"
        variant="secondary"
        icon="edit"
        onClick={() => onEdit(current.fact_id)}
      >
        {t("explore:hotelier.edit")}
      </Button>
    </div>
  )
}

export interface SavedAnswerProps {
  readonly hotelId: string
  readonly question: Question
  readonly factIds: readonly string[]
  readonly conflict: boolean
  readonly next: (() => void) | undefined
  readonly onEditFact: (factId: string) => void
}

export function SavedAnswer({
  hotelId,
  question,
  factIds,
  conflict,
  next,
  onEditFact,
}: SavedAnswerProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const title = conflict
    ? t("explore:hotelier.savedConflict")
    : question.answered_at
      ? t("explore:hotelier.savedAt", { date: format.dateTime(question.answered_at) })
      : t("explore:hotelier.saved")
  return (
    <section className={styles.saved} data-saved-answer={question.id}>
      <Banner tone={conflict ? "warning" : "success"} title={title}>
        {conflict ? t("explore:hotelier.conflictsText") : null}
      </Banner>
      {question.answer_text ? (
        <div className={styles.block}>
          <p className={styles.label}>{t("explore:hotelier.yourAnswer")}</p>
          <p className={styles.text} lang="ru">
            {question.answer_text}
          </p>
        </div>
      ) : null}
      <div className={styles.block}>
        <p className={styles.label}>{t("explore:hotelier.savedValue")}</p>
        {factIds.length ? (
          factIds.map((id) => (
            <LinkedFact key={id} hotelId={hotelId} factId={id} onEdit={onEditFact} />
          ))
        ) : (
          <Banner tone="info" title={t("explore:hotelier.noLink")}>
            {t("explore:hotelier.noLinkText")}
          </Banner>
        )}
      </div>
      {next ? (
        <Button icon="next" onClick={next} className={styles.next}>
          {t("explore:hotelier.next")}
        </Button>
      ) : null}
    </section>
  )
}
