import { matchesOfferStay, StayFields, useHotelOffers, useHotelStay } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Icon, Skeleton } from "@/shared/ui"
import styles from "./hotel-offers.module.css"
import { RoomCatalog } from "./rooms/room-catalog"

const STATUS: Readonly<Record<string, MessageKey>> = {
  provider_unavailable: "explore:offers.providerUnavailable",
  hotel_unmapped: "explore:offers.hotelUnmapped",
  provider_error: "explore:offers.providerError",
  no_offers: "explore:offers.noOffers",
}

function statusKey(status: string | undefined): MessageKey | undefined {
  return status ? STATUS[status] : undefined
}

type Stay = components["schemas"]["SearchResponse"]["parsed"]

export function HotelOffers({
  hotelId,
  stay,
}: {
  readonly hotelId: string
  readonly stay?: Stay | undefined
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const control = useHotelStay(stay)
  const { value } = control
  const { checkIn, checkOut, adults } = value
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const complete = Boolean(checkIn && checkOut && checkOut > checkIn && adults)
  const current = matchesOfferStay(result.data, hotelId, checkIn, checkOut, adults)
    ? result.data
    : undefined
  const status = statusKey(current?.status)
  return (
    <section
      id={`${hotelId}-rooms`}
      tabIndex={-1}
      className={styles.section}
      aria-labelledby={`${hotelId}-offers`}
    >
      <p id={`${hotelId}-offers`} className={styles.heading}>
        <Icon name="calendar" size="sm" />
        {t("explore:offers.title")}
      </p>
      <StayFields control={control} />
      {result.isPending && complete ? <Skeleton shape="block" /> : null}
      {result.isError ? <Banner tone="danger" title={t("explore:offers.requestError")} /> : null}
      {result.isError || current?.status === "provider_error" ? (
        <Button
          variant="secondary"
          size="compact"
          onClick={() => void result.refetch()}
          disabled={result.isFetching}
        >
          {t("common:action.retry")}
        </Button>
      ) : null}
      {current?.sandbox ? <Banner tone="neutral" title={t("explore:offers.sandbox")} /> : null}
      {status ? <Banner tone="neutral" title={t(status)} /> : null}
      {current?.status === "available" && !current.rates_complete ? (
        <Banner tone="neutral" title={t("explore:rooms.partial")} />
      ) : null}
      {current?.status === "available" && !current.sandbox ? (
        <RoomCatalog key={`${hotelId}:${checkIn}:${checkOut}:${adults}`} content={current} />
      ) : null}
      {current?.checked_at ? (
        <p className={styles.note}>
          <Icon name="source" size="sm" />
          {t("explore:offers.source", {
            source: current.source ?? "",
            time: new Intl.DateTimeFormat(locale, {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(current.checked_at)),
          })}
        </p>
      ) : null}
    </section>
  )
}
