import { useLocale, useTranslation } from "@/shared/i18n"
import styles from "./hotel-rating.module.css"

interface HotelRatingProps {
  readonly score: number | undefined
  readonly reviews: number
  readonly size?: "caption" | "body"
}

export function HotelRating({ score, reviews, size = "caption" }: HotelRatingProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!score) return null
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(score)
  return (
    <span
      role="img"
      className={styles.rating}
      data-size={size}
      aria-label={t("explore:cards.rating", { score: value, count: reviews })}
    >
      <b className={styles.score}>{value}</b>
      {reviews > 0 ? (
        <span className={styles.reviews}>{t("explore:cards.reviews", { count: reviews })}</span>
      ) : null}
    </span>
  )
}
