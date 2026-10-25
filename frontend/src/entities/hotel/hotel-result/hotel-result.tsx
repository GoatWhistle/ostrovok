import type { MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import { characteristicIcon } from "@/shared/ui/primitives/icon/characteristic-icon"
import styles from "./hotel-result.module.css"
export interface HotelResultProps {
  readonly result: SearchResult
  readonly selected: boolean
  readonly compared: boolean
  readonly onSelect: () => void
  readonly onCompare: () => void
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}
export function HotelResult({
  result,
  selected,
  compared,
  onSelect,
  onCompare,
  onProperty,
  onPreview,
}: HotelResultProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <article className={styles.result} data-selected={selected}>
      <div className={styles.top}>
        <Icon name="building" size="lg" />
        <Button variant="ghost" onClick={onSelect} aria-pressed={selected} className={styles.name}>
          {result.hotel.name}
        </Button>
      </div>
      {result.hotel.address ? <p className={styles.address}>{result.hotel.address}</p> : null}
      <div className={styles.properties}>
        {result.matched.map((property) => (
          <Button
            key={property.characteristic_key}
            variant="ghost"
            icon={characteristicIcon(property.characteristic_key)}
            onClick={() => onProperty(property)}
            onPointerEnter={() => onPreview(property)}
            onPointerLeave={() => onPreview(undefined)}
            onFocus={() => onPreview(property)}
            onBlur={() => onPreview(undefined)}
          >
            <span className={styles.property}>
              <span>{matchedTitle(property, locale)}</span>
              <span className={styles.match}>{t(`explore:match.${property.match}`)}</span>
            </span>
          </Button>
        ))}
      </div>
      <div className={styles.actions}>
        <Button icon="next" variant="secondary" onClick={onSelect}>
          {selected ? t("explore:results.selected") : t("explore:results.open")}
        </Button>
        <Button variant="ghost" icon="compare" aria-pressed={compared} onClick={onCompare}>
          {compared ? t("explore:results.removeCompare") : t("explore:results.compare")}
        </Button>
      </div>
    </article>
  )
}
