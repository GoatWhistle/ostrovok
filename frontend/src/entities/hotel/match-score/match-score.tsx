import { clsx } from "clsx"
import type { MatchedProperty } from "@/shared/api/hotel-types"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { Icon, StatusBadge } from "@/shared/ui"
import styles from "./match-score.module.css"

const LOW_CONFIDENCE = 0.7

export interface Score {
  readonly full: number
  readonly total: number
}

export function matchScore(result: { readonly matched: readonly MatchedProperty[] }): Score {
  return {
    full: result.matched.filter((property) => property.match === "full").length,
    total: result.matched.length,
  }
}

export interface MatchScoreProps {
  readonly score: Score
  readonly quiet?: boolean
  readonly className?: string | undefined
}

export function MatchScore({ score, quiet = false, className }: MatchScoreProps) {
  const { t } = useTranslation()
  if (score.total === 0) return null
  const complete = score.full === score.total
  const text = t("explore:results.score", { full: score.full, total: score.total })
  if (quiet)
    return (
      <span
        role="img"
        className={clsx(styles.quiet, className)}
        data-complete={complete}
        aria-label={t("explore:cards.score", { full: score.full, total: score.total })}
      >
        <Icon name={complete ? "check" : "partial"} size="sm" className={styles.mark} />
        {text}
      </span>
    )
  return (
    <StatusBadge
      tone={complete ? "fact" : "warning"}
      icon={complete ? "check" : "partial"}
      className={clsx(styles.score, className)}
    >
      {text}
    </StatusBadge>
  )
}

export interface MatchConfidenceProps {
  readonly value: number | undefined
  readonly className?: string | undefined
}

export function MatchConfidence({ value, className }: MatchConfidenceProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  if (value === undefined || value <= 0 || value >= LOW_CONFIDENCE) return null
  return (
    <span className={clsx(styles.confidence, className)}>
      {t("explore:results.confidence", { value: format.percent(value) })}
    </span>
  )
}
