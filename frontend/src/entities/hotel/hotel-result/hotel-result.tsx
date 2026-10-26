import type { CSSProperties } from "react"
import type { MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { staggerStyle } from "@/shared/motion"
import { Button, characteristicHue, characteristicIcon, Icon, type IconName } from "@/shared/ui"
import { HotelThumb } from "../hotel-thumb/hotel-thumb"
import { MatchScore, matchScore } from "../match-score/match-score"
import styles from "./hotel-result.module.css"

export interface HotelResultProps {
  readonly result: SearchResult
  readonly selected: boolean
  readonly index?: number
  readonly onSelect: () => void
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}

const MATCH_ICON: Readonly<Record<MatchedProperty["match"], IconName>> = {
  full: "success",
  partial: "partial",
  none: "rejected",
  unknown: "unknown",
  computing: "pending",
}

export function HotelResult({
  result,
  selected,
  index,
  onSelect,
  onProperty,
  onPreview,
}: HotelResultProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <article
      className={styles.hotel}
      data-selected={selected}
      data-photo={Boolean(result.hotel.thumbnail_url)}
      style={index === undefined ? undefined : staggerStyle(index)}
    >
      {result.hotel.thumbnail_url ? <HotelThumb src={result.hotel.thumbnail_url} /> : null}
      <div className={styles.body}>
        <div className={styles.top}>
          <Button
            variant="ghost"
            align="start"
            className={styles.name}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {result.hotel.name}
          </Button>
          <MatchScore score={matchScore(result)} />
        </div>
        {result.hotel.address ? (
          <p className={styles.meta}>
            <Icon name="pin" size="sm" />
            <span>{result.hotel.address}</span>
          </p>
        ) : null}
        {result.matched.length ? (
          <ul className={styles.matches}>
            {result.matched.map((property) => (
              <li
                key={property.characteristic_key}
                style={{ "--hue": characteristicHue(property.characteristic_key) } as CSSProperties}
              >
                <Button
                  variant="ghost"
                  size="compact"
                  align="start"
                  icon={characteristicIcon(property.characteristic_key)}
                  className={styles.match}
                  onClick={() => onProperty(property)}
                  onPointerEnter={() => onPreview(property)}
                  onPointerLeave={() => onPreview(undefined)}
                  onFocus={() => onPreview(property)}
                  onBlur={() => onPreview(undefined)}
                >
                  <span className={styles.label}>{matchedTitle(property, locale)}</span>
                  <span className={styles.status} data-match={property.match}>
                    <Icon name={MATCH_ICON[property.match]} size="sm" />
                    <span className="visually-hidden">{t(`explore:match.${property.match}`)}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}
