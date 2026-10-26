import type { ReactNode } from "react"
import { FactStatusBadge, SourceBadge } from "@/entities/evidence"
import type { PlaceCard } from "@/entities/place"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { Confidence, StatusBadge } from "@/shared/ui"
import styles from "./place-details.module.css"

export interface PlaceFieldProps {
  readonly card: PlaceCard
  readonly tag: string
  readonly label: string
  readonly children: ReactNode
}

export function PlaceField({ card, tag, label, children }: PlaceFieldProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const fact = card.facts.find((item) => item.characteristic_key === tag)
  return (
    <section className={styles.field}>
      <p className={styles.fieldTitle}>{label}</p>
      <div className={styles.value}>{children}</div>
      {fact ? (
        <div className={styles.provenance}>
          <div className={styles.badges}>
            <SourceBadge source={fact.source_type} />
            <Confidence value={fact.confidence} />
            {fact.status === "active" ? (
              <StatusBadge tone="neutral">{t("explore:status.active")}</StatusBadge>
            ) : (
              <FactStatusBadge status={fact.status} />
            )}
          </div>
          <p>
            {t("explore:place.fieldSource", {
              ref: card.osm_ref,
              date: format.date(card.source.extracted_at),
              license: card.source.license,
            })}
          </p>
        </div>
      ) : null}
    </section>
  )
}
