import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import { useHotelStay } from "./hotel-stay"
import { StayFields } from "./stay-fields"

export function StayBar() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { value } = useHotelStay()
  const { checkIn, checkOut, adults } = value
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
  const chosen = Boolean(checkIn && checkOut > checkIn && adults)
  const title = chosen
    ? t("explore:cards.priceBasis", {
        checkIn: dates.format(new Date(`${checkIn}T12:00:00Z`)),
        checkOut: dates.format(new Date(`${checkOut}T12:00:00Z`)),
        count: adults,
      })
    : t("explore:cards.chooseDates")
  return (
    <Disclosure title={title} icon="calendar">
      <StayFields />
    </Disclosure>
  )
}
