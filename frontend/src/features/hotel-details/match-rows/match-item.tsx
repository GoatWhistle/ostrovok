import { MatchGlyph, RowButton, StatusGlyph } from "@/entities/evidence"
import type { MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/facts/fact-label"
import { isCurrentFact } from "@/shared/geo/facts/matching"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import { useMediaQuery } from "@/shared/hooks"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import type { MatchRowsProps } from "./match-rows"
import styles from "./match-rows.module.css"

interface MatchItemProps extends Omit<MatchRowsProps, "matched"> {
  readonly item: MatchedProperty
}

export function MatchItem({ item, onFact, onProperty, onPreview }: MatchItemProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const narrow = useMediaQuery("(max-width: 47.99rem)")
  const fact = item.fact
  const current = isCurrentFact(fact)
  const hasMap = (item.geo_refs?.length ?? fact?.geo_refs?.length ?? 0) > 0
  const verdict = wishVerdict(item, locale)
  const status = fact && !current ? t(`explore:status.${fact.status}`) : undefined
  const glyph =
    fact && !current ? <StatusGlyph status={fact.status} /> : <MatchGlyph match={item.match} />
  const body = (
    <>
      <span className={styles.label}>{verdict ?? matchedTitle(item, locale)}</span>
      {status ? <span className={styles.note}>{status}</span> : null}
    </>
  )
  return (
    <li className={styles.item}>
      {fact ? (
        <RowButton
          leadingAlign="start"
          leading={glyph}
          trailing={<Icon name="chevron-right" size="sm" className={styles.more} />}
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
          {glyph}
          <span className={styles.body}>{body}</span>
        </div>
      )}
      {hasMap && onProperty ? (
        <Button
          variant="ghost"
          size="compact"
          icon="map"
          iconOnly={narrow}
          onClick={() => onProperty(item)}
        >
          {t("explore:wish.onMap")}
        </Button>
      ) : null}
    </li>
  )
}
