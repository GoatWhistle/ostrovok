import type { MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/facts/fact-label"
import { isUsableMatch } from "@/shared/geo/facts/matching"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import { type Locale, useLocale, useTranslation } from "@/shared/i18n"
import { Button, Popover } from "@/shared/ui"
import { MatchConfidence, matchScore } from "../match-score/match-score"
import styles from "./match-explain.module.css"

type Translate = ReturnType<typeof useTranslation>["t"]

function partialLine(text: string, t: Translate): string {
  const split = text.indexOf(": ")
  if (split < 1) return t("explore:cards.wishPartial", { text })
  return t("explore:cards.wishPartialSplit", {
    head: text.slice(0, split),
    rest: text.slice(split + 2),
  })
}

function wishLine(item: MatchedProperty, locale: Locale, t: Translate): string {
  const title = matchedTitle(item, locale)
  const text = wishVerdict(item, locale) ?? title
  if (isUsableMatch(item)) return item.match === "full" ? text : partialLine(text, t)
  if (item.match === "none") return t("explore:cards.wishNone", { text: title })
  return t("explore:cards.wishMissing", { text: title })
}

export interface MatchExplainProps {
  readonly matched: readonly MatchedProperty[]
  readonly confidence?: number | undefined
  readonly onProperty?: ((property: MatchedProperty) => void) | undefined
  readonly onPreview?: ((property: MatchedProperty | undefined) => void) | undefined
}

export function MatchExplain({ matched, confidence, onProperty, onPreview }: MatchExplainProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const score = matchScore({ matched })
  if (!score.total) return null
  const ordered = [...matched].sort((a, b) => Number(isUsableMatch(b)) - Number(isUsableMatch(a)))
  return (
    <span className={styles.explain}>
      <span
        role="img"
        className={styles.score}
        data-complete={score.full === score.total}
        aria-label={t("explore:cards.score", { full: score.full, total: score.total })}
      >
        {t("explore:results.score", { full: score.full, total: score.total })}
      </span>
      <Popover label={t("explore:cards.whyMatch")} icon="help" placement="bottom-end" hover inline>
        <p className={styles.heading}>
          {t("explore:cards.score", { full: score.full, total: score.total })}
        </p>
        <ul className={styles.list}>
          {ordered.map((item) => (
            <li key={item.characteristic_key}>
              <Button
                variant="ghost"
                align="start"
                className={styles.wish}
                data-match={isUsableMatch(item) ? item.match : "none"}
                onClick={() => onProperty?.(item)}
                onPointerEnter={() => onPreview?.(item)}
                onPointerLeave={() => onPreview?.(undefined)}
                onFocus={() => onPreview?.(item)}
                onBlur={() => onPreview?.(undefined)}
              >
                {wishLine(item, locale, t)}
              </Button>
            </li>
          ))}
        </ul>
        <MatchConfidence value={confidence} className={styles.note} />
      </Popover>
    </span>
  )
}
