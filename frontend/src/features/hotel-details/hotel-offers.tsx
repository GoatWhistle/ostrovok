import { useState } from "react"
import { useHotelOffers } from "@/entities/hotel"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Skeleton } from "@/shared/ui"
import styles from "./hotel-offers.module.css"

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

interface HotelOffersProps {
  readonly hotelId: string
}

export function HotelOffers({ hotelId }: HotelOffersProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const today = localDate(new Date())
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 1))
  const [adults, setAdults] = useState(2)
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <section className={styles.section} aria-label={t("explore:offers.title")}>
      <strong className={styles.heading}>{t("explore:offers.title")}</strong>
      <div className={styles.fields}>
        <label>
          <span>{t("explore:offers.checkIn")}</span>
          <input
            type="date"
            min={today}
            max={addDays(today, 730)}
            value={checkIn}
            onChange={(event) => {
              const value = event.target.value
              setCheckIn(value)
              if (value && (checkOut <= value || checkOut > addDays(value, 30))) {
                setCheckOut(addDays(value, 1))
              }
            }}
          />
        </label>
        <label>
          <span>{t("explore:offers.checkOut")}</span>
          <input
            type="date"
            min={addDays(checkIn, 1)}
            max={addDays(checkIn, 30)}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.guests}>
        <span>{t("explore:offers.adults", { count: adults })}</span>
        <Button variant="ghost" disabled={adults <= 1} onClick={() => setAdults(adults - 1)}>
          {t("explore:offers.less")}
        </Button>
        <Button variant="ghost" disabled={adults >= 10} onClick={() => setAdults(adults + 1)}>
          {t("explore:offers.more")}
        </Button>
      </div>
      {!checkIn || !checkOut ? (
        <p className={styles.muted}>{t("explore:offers.pickDates")}</p>
      ) : null}
      {result.isPending && checkIn && checkOut ? <Skeleton /> : null}
      {result.isError ? <p className={styles.muted}>{t("explore:offers.requestError")}</p> : null}
      {result.data?.status === "provider_unavailable" ? (
        <p className={styles.muted}>{t("explore:offers.providerUnavailable")}</p>
      ) : null}
      {result.data?.status === "hotel_unmapped" ? (
        <p className={styles.muted}>{t("explore:offers.hotelUnmapped")}</p>
      ) : null}
      {result.data?.status === "provider_error" ? (
        <p className={styles.muted}>{t("explore:offers.providerError")}</p>
      ) : null}
      {result.data?.status === "sold_out" ? (
        <p className={styles.muted}>{t("explore:offers.soldOut")}</p>
      ) : null}
      {result.data?.offers?.map((offer) => (
        <div key={offer.id} className={styles.offer}>
          <strong>{offer.room_name}</strong>
          <span>{money(offer.price_amount, offer.price_currency)}</span>
          <span>{t("explore:offers.availableRooms", { count: offer.available_rooms })}</span>
          {offer.meal ? (
            <span>{t("explore:offers.meal", { value: mealLabel(offer.meal, t) })}</span>
          ) : null}
          {offer.floor_number != null ? (
            <span>{t("explore:offers.floor", { value: offer.floor_number })}</span>
          ) : null}
        </div>
      ))}
      {result.data?.checked_at ? (
        <p className={styles.muted}>
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

function mealLabel(value: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const key = value.includes("all-inclusive")
    ? "allInclusive"
    : value === "breakfast"
      ? "breakfast"
      : value === "half-board"
        ? "halfBoard"
        : value === "full-board"
          ? "fullBoard"
          : "unknownMeal"
  return t(`explore:offers.${key}`)
}
