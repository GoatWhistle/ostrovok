import { StayFields, useHotelOffers, useHotelStay } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Icon, Skeleton } from "@/shared/ui"
import styles from "./hotel-offers.module.css"
import { RoomCatalog } from "./rooms/room-catalog"
import { SupplierDetails } from "./supplier/supplier-details"

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
  const status = statusKey(result.data?.status)
  return (
    <section className={styles.section} aria-labelledby={`${hotelId}-offers`}>
      <p id={`${hotelId}-offers`} className={styles.heading}>
        <Icon name="calendar" size="sm" />
        {t("explore:offers.title")}
      </p>
      <StayFields control={control} />
      {result.isPending && complete ? <Skeleton shape="block" /> : null}
      {result.isError ? <Banner tone="danger" title={t("explore:offers.requestError")} /> : null}
      {result.isError || result.data?.status === "provider_error" ? (
        <Button
          variant="secondary"
          size="compact"
          onClick={() => void result.refetch()}
          disabled={result.isFetching}
        >
          {t("common:action.retry")}
        </Button>
      ) : null}
      {result.data?.sandbox ? <Banner tone="neutral" title={t("explore:offers.sandbox")} /> : null}
      {status ? <Banner tone="neutral" title={t(status)} /> : null}
      {result.data?.status === "available" && !result.data.rates_complete ? (
        <Banner tone="neutral" title={t("explore:rooms.partial")} />
      ) : null}
      {result.data ? (
        <RoomCatalog key={`${hotelId}:${checkIn}:${checkOut}:${adults}`} content={result.data} />
      ) : null}
      {result.data?.status === "available" ? (
        <p role="status">{t("explore:offers.available")}</p>
      ) : null}
      {result.data?.details ? (
        <SupplierDetails details={result.data.details} source={result.data.source} />
      ) : null}
      {result.data?.checked_at ? (
        <p className={styles.note}>
          <Icon name="source" size="sm" />
          {t("explore:offers.source", {
            source: result.data.source ?? "",
            time: new Intl.DateTimeFormat(locale, {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(result.data.checked_at)),
          })}
        </p>
      ) : null}
    </section>
  )
}
