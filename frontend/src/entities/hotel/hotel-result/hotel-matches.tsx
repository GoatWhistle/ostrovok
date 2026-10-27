import type { MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { isUsableMatch } from "@/shared/geo/facts/matching"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import { useLocale } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./hotel-matches.module.css"

const SHOWN = 2

interface HotelMatchesProps {
  readonly matched: readonly MatchedProperty[]
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}

export function HotelMatches({ matched, onProperty, onPreview }: HotelMatchesProps) {
  const { locale } = useLocale()
  const found = matched
    .filter(isUsableMatch)
    .sort((a, b) => Number(b.match === "full") - Number(a.match === "full"))
    .slice(0, SHOWN)
  if (!found.length) return null
  return (
    <ul className={styles.matches}>
      {found.map((item) => (
        <li key={item.characteristic_key}>
          <Button
            variant="ghost"
            align="start"
            icon={item.match === "full" ? "success" : "partial"}
            className={styles.match}
            data-match={item.match}
            onClick={() => onProperty(item)}
            onPointerEnter={() => onPreview(item)}
            onPointerLeave={() => onPreview(undefined)}
            onFocus={() => onPreview(item)}
            onBlur={() => onPreview(undefined)}
          >
            <span className={styles.text}>
              {wishVerdict(item, locale) ?? matchedTitle(item, locale)}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  )
}
