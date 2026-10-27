import {
  matchesOfferStay,
  StayFields,
  useHotelDetails,
  useHotelOffers,
  useHotelStay,
} from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./hotel-offers.module.css"
import { OfferState, offerRequest } from "./offer-state"
import { roomGroups, SupplierSection } from "./supplier/supplier-section"

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
type Offers = components["schemas"]["HotelOffers"]

function OfferOutcome({ content }: { readonly content: Offers }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <>
      {content.status === "available" ? <p role="status">{t("explore:offers.available")}</p> : null}
      {content.checked_at ? (
        <p className={styles.note}>
          <Icon name="source" size="sm" />
          {t("explore:offers.source", {
            source: content.source ?? "",
            time: new Intl.DateTimeFormat(locale, {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(content.checked_at)),
          })}
        </p>
      ) : null}
    </>
  )
}

export function HotelOffers({
  hotelId,
  stay,
}: {
  readonly hotelId: string
  readonly stay?: Stay | undefined
}) {
  const { t } = useTranslation()
  const control = useHotelStay(stay)
  const { checkIn, checkOut, adults } = control.value
  const result = useHotelOffers(hotelId, checkIn, checkOut, adults)
  const catalog = useHotelDetails(hotelId)
  const dated = Boolean(checkIn && checkOut && checkOut > checkIn && adults)
  const current = matchesOfferStay(result.data, hotelId, checkIn, checkOut, adults)
    ? result.data
    : undefined
  const rated = current?.status === "available" && !current.sandbox
  const priced = rated ? current : undefined
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
      <OfferState
        request={offerRequest(result, catalog, dated)}
        status={statusKey(current?.status ?? catalog.data?.status)}
        sandbox={Boolean(current?.sandbox)}
        partial={Boolean(priced && !priced.rates_complete)}
      />
      <SupplierSection
        hotelId={hotelId}
        details={current?.details ?? catalog.data?.details}
        source={current?.source ?? catalog.data?.source}
        rooms={roomGroups(priced, catalog.data?.room_groups)}
        content={priced}
        stay={`${checkIn}:${checkOut}:${adults}`}
        dated={dated}
      />
      {current ? <OfferOutcome content={current} /> : null}
    </section>
  )
}
