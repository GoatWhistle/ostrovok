import { useState } from "react"
import { useHotelOffers } from "@/entities/hotel"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Icon, Skeleton, TextField } from "@/shared/ui"
import styles from "./hotel-offers.module.css"
import { OfferCard } from "./offer-card"

function localDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value || localDate(new Date())}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

const STATUS: Readonly<Record<string, MessageKey>> = {
  provider_unavailable: "explore:offers.providerUnavailable",
  hotel_unmapped: "explore:offers.hotelUnmapped",
  provider_error: "explore:offers.providerError",
  sold_out: "explore:offers.soldOut",
}

export function HotelOffers({ hotelId }: { readonly hotelId: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const today = localDate(new Date())
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 1))
  const [adults, setAdults] = useState(2)
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const status = result.data?.status ? STATUS[result.data.status] : undefined
  return (
    <section className={styles.section} aria-labelledby={`${hotelId}-offers`}>
      <p id={`${hotelId}-offers`} className={styles.heading}>
        <Icon name="calendar" size="sm" />
        {t("explore:offers.title")}
      </p>
      <div className={styles.fields}>
        <TextField
          type="date"
          label={t("explore:offers.checkIn")}
          min={today}
          max={addDays(today, 730)}
          value={checkIn}
          onChange={(event) => {
            const value = event.target.value
            setCheckIn(value)
            if (value && (checkOut <= value || checkOut > addDays(value, 30)))
              setCheckOut(addDays(value, 1))
          }}
        />
        <TextField
          type="date"
          label={t("explore:offers.checkOut")}
          min={addDays(checkIn, 1)}
          max={addDays(checkIn, 30)}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
        />
      </div>
      <div className={styles.guests}>
        <Icon name="guests" size="sm" className={styles.guestIcon} />
        <span className={styles.guestLabel}>{t("explore:offers.adults", { count: adults })}</span>
        <Button
          variant="secondary"
          size="compact"
          iconOnly
          icon="minus"
          title={t("explore:offers.less")}
          disabled={adults <= 1}
          onClick={() => setAdults(adults - 1)}
        >
          {t("explore:offers.less")}
        </Button>
        <Button
          variant="secondary"
          size="compact"
          iconOnly
          icon="plus"
          title={t("explore:offers.more")}
          disabled={adults >= 10}
          onClick={() => setAdults(adults + 1)}
        >
          {t("explore:offers.more")}
        </Button>
      </div>
      {!checkIn || !checkOut ? (
        <p className={styles.note}>{t("explore:offers.pickDates")}</p>
      ) : null}
      {result.isPending && checkIn && checkOut ? <Skeleton shape="block" /> : null}
      {result.isError ? <Banner tone="danger" title={t("explore:offers.requestError")} /> : null}
      {status ? <Banner tone="neutral" title={t(status)} /> : null}
      {result.data?.offers?.length ? (
        <ul className={styles.offers}>
          {result.data.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </ul>
      ) : null}
      {result.data?.checked_at ? (
        <p className={styles.note}>
          <Icon name="source" size="sm" />
          {t("explore:offers.source", {
            source: result.data.source ?? "",
            time: new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(result.data.checked_at)),
          })}
        </p>
      ) : null}
    </section>
  )
}
