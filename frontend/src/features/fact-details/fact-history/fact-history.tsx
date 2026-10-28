import { FactStatusBadge, StatusGlyph, sourceIcon } from "@/entities/evidence"
import type { Fact } from "@/shared/api/hotel-types"
import { factLabel } from "@/shared/geo/fact-label"
import { useFormatters, useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./fact-history.module.css"

export interface FactHistoryProps {
  readonly history: readonly Fact[]
}

export function FactHistory({ history }: FactHistoryProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const format = useFormatters()
  return (
    <ol className={styles.timeline}>
      {history.map((fact) => {
        const computed = fact.provenance?.computed_at
        return (
          <li key={fact.fact_id} className={styles.entry} data-status={fact.status}>
            <span className={styles.dot}>
              <Icon name={sourceIcon(fact.source_type)} size="sm" />
            </span>
            <div className={styles.body}>
              <span className={styles.label}>{factLabel(fact, locale)}</span>
              <span className={styles.meta}>
                {t(`explore:source.${fact.source_type}`)}
                {computed && Number.isFinite(Date.parse(computed)) ? (
                  <time dateTime={computed}>{format.date(computed)}</time>
                ) : null}
              </span>
            </div>
            {fact.status === "active" ? (
              <StatusGlyph status={fact.status} />
            ) : (
              <FactStatusBadge status={fact.status} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
