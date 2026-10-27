import { FactStatusBadge, HueIcon, MatchGlyph, RowButton } from "@/entities/evidence"
import type { MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { isCurrentFact } from "@/shared/geo/facts/matching"
import { factScope } from "@/shared/geo/facts/scope"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import type { MatchRowsProps } from "./match-rows"
import styles from "./match-rows.module.css"

interface MatchItemProps extends Omit<MatchRowsProps, "matched"> {
  readonly item: MatchedProperty
}

export function MatchItem({ item, onFact, onProperty, onPreview }: MatchItemProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const fact = item.fact
  const current = isCurrentFact(fact)
  const hasMap = (item.geo_refs?.length ?? fact?.geo_refs?.length ?? 0) > 0
  const body = (
    <>
      <span className={styles.label}>{matchedTitle(item, locale)}</span>
      <span className={styles.caption}>
        {fact && !current ? t(`explore:status.${fact.status}`) : t(`explore:match.${item.match}`)}
      </span>
      {fact
        ? factScope(fact, locale).map((text) => (
            <span key={text} className={styles.caption}>
              {text}
            </span>
          ))
        : null}
      {item.explanation ? (
        <span className={styles.caption} lang="ru">
          {item.explanation}
        </span>
      ) : null}
    </>
  )
  const trailing =
    fact && !current ? <FactStatusBadge status={fact.status} /> : <MatchGlyph match={item.match} />
  return (
    <li className={styles.item}>
      {fact ? (
        <RowButton
          leadingAlign="start"
          leading={<HueIcon characteristicKey={item.characteristic_key} />}
          trailing={trailing}
          onClick={() => onFact(fact)}
          onPointerEnter={() => onPreview?.(item)}
          onPointerLeave={() => onPreview?.(undefined)}
          onFocus={() => onPreview?.(item)}
          onBlur={() => onPreview?.(undefined)}
        >
          {body}
        </RowButton>
      ) : (
        <div className={styles.static}>
          <HueIcon characteristicKey={item.characteristic_key} />
          <span className={styles.body}>{body}</span>
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
}
