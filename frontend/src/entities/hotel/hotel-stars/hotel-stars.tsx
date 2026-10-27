import { useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./hotel-stars.module.css"

export function HotelStars({ value }: { readonly value: number | null | undefined }) {
  const { t } = useTranslation()
  if (!value || !Number.isInteger(value) || value < 1 || value > 5) return null
  return (
    <span
      role="img"
      className={styles.stars}
      aria-label={t("explore:details.summaryStars", { count: value })}
    >
      {Array.from({ length: value }, (_, index) => index + 1).map((star) => (
        <Icon key={star} name="star" size="sm" />
      ))}
    </span>
  )
}
