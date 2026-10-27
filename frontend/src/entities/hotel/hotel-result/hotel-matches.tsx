import type { MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { isUsableMatch } from "@/shared/geo/facts/matching"
import { factScope } from "@/shared/geo/facts/scope"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, characteristicIcon } from "@/shared/ui"
import styles from "./hotel-matches.module.css"

interface HotelMatchesProps {
  readonly matched: readonly MatchedProperty[]
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}

export function HotelMatches({ matched, onProperty, onPreview }: HotelMatchesProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const found = matched.filter(isUsableMatch)
  if (!found.length) return null
  return (
    <ul className={styles.matches}>
      {found.map((item) => (
        <li key={item.characteristic_key}>
          <Button
            variant="ghost"
            align="start"
            icon={characteristicIcon(item.characteristic_key)}
            className={styles.match}
            onClick={() => onProperty(item)}
            onPointerEnter={() => onPreview(item)}
            onPointerLeave={() => onPreview(undefined)}
            onFocus={() => onPreview(item)}
            onBlur={() => onPreview(undefined)}
          >
            <span className={styles.label}>{matchedTitle(item, locale)}</span>
          </Button>
          {item.match === "partial" ? (
            <p className={styles.partial}>{t("explore:match.partial")}</p>
          ) : null}
          {item.fact
            ? factScope(item.fact, locale).map((text) => (
                <p className={styles.scope} key={text}>
                  {text}
                </p>
              ))
            : null}
          {item.match === "partial" && item.explanation ? (
            <p className={styles.scope}>{item.explanation}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
