import { HueIcon, StatusGlyph } from "@/entities/evidence"
import type { FactBrief } from "@/shared/api/hotel-types"
import { factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Confidence, StatusBadge } from "@/shared/ui"
import type { ComparisonField } from "./compare-diff"
import styles from "./compare-row.module.css"

export interface CompareRowProps {
  readonly field: ComparisonField
  readonly title: string
  readonly fact: FactBrief | undefined
  readonly hotelId: string
  readonly onFact: (hotelId: string, factId: string) => void
}

export function CompareRow({ field, title, fact, hotelId, onFact }: CompareRowProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <div className={styles.row} data-different={field.different} data-characteristic={field.key}>
      <p className={styles.title}>
        <HueIcon characteristicKey={field.key} />
        {title}
      </p>
      {fact ? (
        <>
          <Button
            className={styles.value}
            align="start"
            variant="ghost"
            onClick={() => onFact(hotelId, fact.fact_id)}
          >
            <StatusGlyph status={fact.status} />
            {fact.characteristic_key === "noise_level" && typeof fact.value === "number"
              ? t("explore:compare.noiseIndex", {
                  value: new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 }).format(
                    fact.value,
                  ),
                })
              : factLabel(fact, locale)}
          </Button>
          <div className={styles.evidence}>
            <span>{t(`explore:source.${fact.source_type}`)}</span>
            <Confidence value={fact.confidence} />
          </div>
          {field.best.includes(hotelId) ? (
            <StatusBadge tone="fact" icon="check">
              {t("explore:compare.better")}
            </StatusBadge>
          ) : null}
        </>
      ) : (
        <p className={styles.missing}>{t("explore:compare.noData")}</p>
      )}
    </div>
  )
}
