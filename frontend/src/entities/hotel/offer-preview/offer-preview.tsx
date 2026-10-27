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
  const matching = matchesOfferStay(result.data, hotelId, checkIn, checkOut, adults)
  const offers = minimumOffers(matching ? result.data : undefined)
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" })
  const unavailable = result.data?.sandbox
    ? "explore:offers.sandbox"
    : result.data?.status === "no_offers"
      ? "explore:offers.noOffers"
      : "explore:cards.noPrice"
  return (
    <div className={styles.preview}>
      {!complete ? null : result.isPending ? (
        <Skeleton lines={1} />
      ) : offers.length ? (
        <>
          {offers.map((offer) => (
            <p key={offer.price_currency} className={styles.price}>
              {t("explore:offers.fromPrice", {
                price: new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: offer.price_currency,
                }).format(offer.price_amount),
              })}
            </p>
          ))}
          <p>
            {t("explore:cards.priceBasis", {
              checkIn: dates.format(new Date(`${checkIn}T12:00:00Z`)),
              checkOut: dates.format(new Date(`${checkOut}T12:00:00Z`)),
              count: adults,
            })}
          </p>
          <p>{t("explore:offers.stayTotal")}</p>
          {!result.data?.rates_complete ? <p>{t("explore:rooms.partial")}</p> : null}
        </>
      ) : (
        <p>{t(unavailable)}</p>
      )}
      <Button variant="ghost" size="compact" icon="calendar" onClick={onSelect}>
        {t("explore:offers.viewRooms")}
      </Button>
    </div>
  )
}
