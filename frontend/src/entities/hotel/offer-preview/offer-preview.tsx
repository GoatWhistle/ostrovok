import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Skeleton } from "@/shared/ui"
import { useHotelOffers } from "../hotel.queries"
import { useHotelStay } from "../hotel-stay/hotel-stay"
import styles from "./offer-preview.module.css"

export function OfferPreview({
  hotelId,
  onSelect,
  enabled,
}: {
  readonly hotelId: string
  readonly onSelect: () => void
  readonly enabled: boolean
}) {
  const { value } = useHotelStay()
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { checkIn, checkOut, adults } = value
  const result = useHotelOffers(enabled ? hotelId : undefined, checkIn, checkOut, adults)
  if (!checkIn || checkOut <= checkIn || !adults || !enabled)
    return (
      <Button variant="ghost" size="compact" onClick={onSelect}>
        {t("explore:offers.viewRooms")}
      </Button>
    )
  if (result.isPending && !result.isError)
    return (
      <div role="status" aria-label={t("explore:offers.checking")}>
        <Skeleton lines={2} />
      </div>
    )
  const offer = [...(result.data?.offers ?? [])].sort((a, b) => a.price_amount - b.price_amount)[0]
  if (result.data?.status === "available" && offer) {
    const price = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: offer.price_currency,
      maximumFractionDigits: 0,
    }).format(offer.price_amount)
    return (
      <div className={styles.preview}>
        <p className={styles.price}>{t("explore:offers.fromPrice", { price })}</p>
        <p>{t("explore:offers.stayTotal")}</p>
        <p>{t("explore:offers.available")}</p>
        <p lang="ru">{offer.room_name}</p>
        <p>{t("explore:offers.provider", { source: result.data.source ?? "" })}</p>
        <Button variant="secondary" size="compact" onClick={onSelect}>
          {t("explore:offers.viewRooms")}
        </Button>
      </div>
    )
  }
  const key =
    result.data?.status === "no_offers"
      ? "explore:offers.noOffers"
      : result.data?.status === "hotel_unmapped"
        ? "explore:offers.hotelUnmapped"
        : "explore:offers.requestError"
  return (
    <div className={styles.preview} role="status">
      <p>{t(key)}</p>
      <Button variant="ghost" size="compact" onClick={onSelect}>
        {t("explore:offers.viewRooms")}
      </Button>
    </div>
  )
}
