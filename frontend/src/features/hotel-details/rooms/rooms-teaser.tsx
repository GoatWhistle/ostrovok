import { RowButton } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Icon, Skeleton } from "@/shared/ui"
import styles from "./rooms.module.css"
import { useRoomOffers } from "./use-room-offers"

type Stay = components["schemas"]["SearchResponse"]["parsed"]

export function RoomsTeaser({
  hotelId,
  stay,
  onOpen,
}: {
  readonly hotelId: string
  readonly stay?: Stay | undefined
  readonly onOpen: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const offers = useRoomOffers(hotelId, stay)
  if (offers.catalog.isPending) return <Skeleton shape="block" className={styles.teaserSkeleton} />
  if (offers.unreachable)
    return (
      <p className={styles.unreachable}>
        <Icon name="room" size="sm" />
        {t("explore:roomsScreen.unreachable")}
      </p>
    )
  const count = offers.rooms.length
  const price = offers.cheapest
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: offers.cheapest.price_currency,
        maximumFractionDigits: 0,
      }).format(offers.cheapest.price_amount)
    : undefined
  const summary = price
    ? t("explore:roomsScreen.teaserPriced", { count, price })
    : count
      ? t("explore:roomsScreen.teaserDates", { count })
      : t("explore:roomsScreen.teaserEmpty")
  return (
    <RowButton
      className={styles.teaser}
      trailing={
        <>
          <Icon name="room" size="sm" className={styles.teaserIcon} />
          <Icon name="chevron-right" size="sm" />
        </>
      }
      onClick={onOpen}
    >
      <span className={styles.teaserTitle}>{t("explore:roomsScreen.title")}</span>
      <span className={styles.teaserText}>{summary}</span>
    </RowButton>
  )
}
