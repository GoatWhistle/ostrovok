import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Skeleton } from "@/shared/ui"
import { useHotelOffers } from "../hotel.queries"
import { useHotelStay } from "../hotel-stay/hotel-stay"
import styles from "./offer-preview.module.css"
import { matchesOfferStay, minimumOffers } from "./offer-prices"

interface OfferPreviewProps {
  readonly hotelId: string
  readonly onSelect: () => void
  readonly enabled: boolean
}

export function OfferPreview({ enabled, ...props }: OfferPreviewProps) {
  return enabled ? <VisibleOfferPreview {...props} /> : null
}

function VisibleOfferPreview({ hotelId, onSelect }: Omit<OfferPreviewProps, "enabled">) {
  const { value } = useHotelStay()
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { checkIn, checkOut, adults } = value
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const complete = Boolean(checkIn && checkOut > checkIn && adults > 0)
  if (!complete) return null
  if (result.isPending) return <Skeleton className={styles.pending} />
  const matching = matchesOfferStay(result.data, hotelId, checkIn, checkOut, adults)
  const offer = minimumOffers(matching ? result.data : undefined)[0]
  if (!offer) return <span className={styles.none}>{t("explore:cards.noPrice")}</span>
  return (
    <Button
      variant="ghost"
      size="compact"
      className={styles.price}
      title={t("explore:offers.stayTotal")}
      onClick={onSelect}
    >
      {t("explore:offers.fromPrice", {
        price: new Intl.NumberFormat(locale, {
          style: "currency",
          currency: offer.price_currency,
          maximumFractionDigits: 0,
        }).format(offer.price_amount),
      })}
    </Button>
  )
}
