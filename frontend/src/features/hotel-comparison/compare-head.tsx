import type { ReactNode } from "react"
import { HotelStars, HotelThumb, useHotelOffers, useHotelStay } from "@/entities/hotel"
import type { HotelSummary, SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, CloseButton, Skeleton } from "@/shared/ui"
import styles from "./compare-head.module.css"

type Supplier = components["schemas"]["SupplierDetails"]

export interface CompareHeadProps {
  readonly id: string
  readonly hotel: HotelSummary | undefined
  readonly supplier: Supplier | undefined
  readonly match: SearchResult | undefined
  readonly media?: ReactNode
  readonly pending: boolean
  readonly failed: boolean
  readonly onRetry: () => void
  readonly onRemove: () => void
}

function CompareRating({ rating }: { readonly rating: Supplier["rating"] | undefined }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (typeof rating?.total !== "number") return null
  const score = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating.total)
  return (
    <span className={styles.rating}>
      {rating.reviews_count
        ? t("explore:compare.ratingReviews", { score, count: rating.reviews_count })
        : score}
    </span>
  )
}

function CompareFit({ match }: { readonly match: SearchResult }) {
  const { t } = useTranslation()
  const total = match.matched.length
  if (!total) return null
  const full = match.matched.filter((item) => item.match === "full").length
  return <span className={styles.fit}>{t("explore:compare.fit", { full, total })}</span>
}

function ComparePrice({ id }: { readonly id: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { value } = useHotelStay()
  const offers = useHotelOffers(id, value.checkIn, value.checkOut, value.adults || 2)
  if (!value.checkIn || !value.checkOut) return null
  if (offers.isPending && offers.fetchStatus !== "idle") return <Skeleton lines={1} />
  if (offers.isError)
    return (
      <Button variant="ghost" size="compact" icon="retry" onClick={() => void offers.refetch()}>
        {t("explore:compare.retryPrice")}
      </Button>
    )
  const cheapest = [...(offers.data?.offers ?? [])].sort(
    (a, b) => a.price_amount - b.price_amount,
  )[0]
  if (!cheapest) return <p className={styles.noPrice}>{t("explore:compare.priceMissing")}</p>
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cheapest.price_currency,
    maximumFractionDigits: 0,
  }).format(cheapest.price_amount)
  return <p className={styles.price}>{t("explore:compare.priceFrom", { price })}</p>
}

export function CompareMedia({
  hotel,
  supplier,
  compact = false,
}: Pick<CompareHeadProps, "hotel" | "supplier"> & { readonly compact?: boolean }) {
  return (
    <HotelThumb
      src={hotel?.thumbnail_url}
      photos={hotel?.photos}
      extra={supplier?.photos.map((photo) => photo.url)}
      placeholder
      className={compact ? styles.thumb : styles.photo}
    />
  )
}

export function CompareHead({
  id,
  hotel,
  supplier,
  match,
  media,
  pending,
  failed,
  onRetry,
  onRemove,
}: CompareHeadProps) {
  const { t } = useTranslation()
  const name = hotel?.name ?? supplier?.name
  const stars = hotel?.stars ?? supplier?.facts.star_rating
  return (
    <div className={styles.head}>
      {media}
      <div className={styles.title}>
        {name ? (
          <p className={styles.name} dir="auto" title={name}>
            {name}
          </p>
        ) : null}
        {pending && !name ? <Skeleton lines={1} /> : null}
        {failed && !name ? (
          <Button variant="ghost" size="compact" icon="retry" onClick={onRetry}>
            {t("explore:compare.cardError")}
          </Button>
        ) : null}
        <CloseButton label={t("explore:compare.remove", { name: name ?? id })} onClick={onRemove} />
      </div>
      <div className={styles.meta}>
        <HotelStars value={stars} />
        <CompareRating rating={supplier?.rating} />
        {match ? <CompareFit match={match} /> : null}
      </div>
      <ComparePrice id={id} />
    </div>
  )
}
