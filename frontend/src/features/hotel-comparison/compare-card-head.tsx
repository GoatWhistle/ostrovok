import { HotelThumb, MatchScore, matchScore, useHotelOffers } from "@/entities/hotel"
import type { SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, ErrorState, Skeleton } from "@/shared/ui"
import styles from "./compare-card-head.module.css"

export interface CompareCardHeadProps {
  readonly id: string
  readonly card: components["schemas"]["HotelCard"] | undefined
  readonly match: SearchResult | undefined
  readonly pending: boolean
  readonly failed: boolean
  readonly onRetry: () => void
  readonly onRemove: () => void
  readonly checkIn: string
  readonly checkOut: string
}

export function CompareCardHead({
  id,
  card,
  match,
  pending,
  failed,
  onRetry,
  onRemove,
  checkIn,
  checkOut,
}: CompareCardHeadProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const offers = useHotelOffers(id, checkIn, checkOut, 2)
  const prices =
    offers.data?.offers?.map((offer) => ({
      amount: offer.price_amount,
      currency: offer.price_currency,
    })) ?? []
  const price = prices.sort((a, b) => a.amount - b.amount)[0]
  const hotel = card?.hotel ?? match?.hotel
  return (
    <Card
      as="div"
      className={styles.head}
      title={
        <span className={styles.name} dir="auto">
          {hotel?.name ?? t("explore:compare.hotelPending")}
        </span>
      }
      actions={
        <Button icon="close" iconOnly variant="ghost" onClick={onRemove}>
          {t("explore:compare.remove", { name: hotel?.name ?? id })}
        </Button>
      }
    >
      <HotelThumb src={hotel?.thumbnail_url} className={styles.photo} />
      {hotel?.stars ? (
        <p className={styles.meta}>{t("explore:compare.stars", { count: hotel.stars })}</p>
      ) : null}
      <p className={styles.meta}>{hotel?.address || t("explore:compare.addressMissing")}</p>
      {match ? <MatchScore score={matchScore(match)} /> : null}
      {pending ? <Skeleton lines={2} /> : null}
      {failed ? <ErrorState title={t("explore:compare.cardError")} onRetry={onRetry} /> : null}
      <p className={styles.price}>
        {price
          ? new Intl.NumberFormat(locale, { style: "currency", currency: price.currency }).format(
              price.amount,
            )
          : t("explore:compare.priceMissing")}
      </p>
      {offers.isFetching ? <Skeleton lines={1} /> : null}
      {offers.isError ? (
        <Button variant="ghost" onClick={() => void offers.refetch()}>
          {t("explore:compare.retryPrice")}
        </Button>
      ) : null}
    </Card>
  )
}
