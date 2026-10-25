import { HueIcon, MatchGlyph, RowButton } from "@/entities/evidence"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import { DetailsSection } from "./details-section"
import styles from "./match-rows.module.css"

export interface MatchRowsProps {
  readonly matched: readonly MatchedProperty[]
  readonly onProperty: ((property: MatchedProperty) => void) | undefined
  readonly onFact: (fact: FactBrief) => void
  readonly onPreview: ((property: MatchedProperty | undefined) => void) | undefined
}

export function MatchRows({ matched, onProperty, onFact, onPreview }: MatchRowsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <DetailsSection title={t("explore:details.yourRequest")}>
      <ul className={styles.list}>
        {matched.map((item) => {
          const fact = item.fact
          const hasMap = (item.geo_refs?.length ?? fact?.geo_refs?.length ?? 0) > 0
          const title = matchedTitle(item, locale)
          const caption = fact ? t(`explore:match.${item.match}`) : t("explore:details.noEvidence")
          const leading = <HueIcon characteristicKey={item.characteristic_key} />
          const trailing = <MatchGlyph match={item.match} />
          return (
            <li key={item.characteristic_key} className={styles.item}>
              {fact ? (
                <RowButton
                  leading={leading}
                  trailing={trailing}
                  onClick={() => onFact(fact)}
                  onPointerEnter={() => onPreview?.(item)}
                  onPointerLeave={() => onPreview?.(undefined)}
                  onFocus={() => onPreview?.(item)}
                  onBlur={() => onPreview?.(undefined)}
                >
                  <span className={styles.label}>{title}</span>
                  <span className={styles.caption}>{caption}</span>
                </RowButton>
              ) : (
                <div className={styles.static}>
                  {leading}
                  <span className={styles.body}>
                    <span className={styles.label}>{title}</span>
                    <span className={styles.caption}>{caption}</span>
                  </span>
                  {trailing}
                </div>
              )}
              {hasMap && onProperty ? (
                <Button
                  variant="ghost"
                  size="compact"
                  icon="map"
                  iconOnly
                  title={t("explore:details.showOnMap")}
                  onClick={() => onProperty(item)}
                >
                  {t("explore:details.showOnMap")}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </DetailsSection>
  )
}
