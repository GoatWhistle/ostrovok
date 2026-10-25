import { clsx } from "clsx"
import type { SearchResult } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { StatusBadge } from "@/shared/ui"
import styles from "./match-score.module.css"

export interface Score {
  readonly full: number
  readonly total: number
}

export function matchScore(result: Pick<SearchResult, "matched">): Score {
  return {
    full: result.matched.filter((property) => property.match === "full").length,
    total: result.matched.length,
  }
}

export interface MatchScoreProps {
  readonly score: Score
  readonly className?: string | undefined
}

export function MatchScore({ score, className }: MatchScoreProps) {
  const { t } = useTranslation()
  if (score.total === 0) return null
  const complete = score.full === score.total
  return (
    <StatusBadge
      tone={complete ? "fact" : "warning"}
      icon={complete ? "check" : "partial"}
      className={clsx(styles.score, className)}
    >
      {t("explore:results.score", { full: score.full, total: score.total })}
    </StatusBadge>
  )
}
