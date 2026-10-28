import { useEffect, useRef } from "react"
import { StayFields } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { Button, Disclosure } from "@/shared/ui"
import { RoomList } from "../room-list/room-list"
import { OfferState, offerRequest } from "./offer-state"
import { RoomCatalog } from "./room-catalog"
import styles from "./rooms.module.css"
import { useRoomOffers } from "./use-room-offers"

type Stay = components["schemas"]["SearchResponse"]["parsed"]

const STATUS: Readonly<Record<string, MessageKey>> = {
  provider_unavailable: "explore:offers.providerUnavailable",
  hotel_unmapped: "explore:offers.hotelUnmapped",
  provider_error: "explore:offers.providerError",
  no_offers: "explore:offers.noOffers",
}

export function RoomsScreen({
  hotelId,
  hotelName,
  stay,
  onBack,
  hotelRooms = [],
}: {
  readonly hotelId: string
  readonly hotelName: string
  readonly stay?: Stay | undefined
  readonly onBack: () => void
  readonly hotelRooms?: components["schemas"]["HotelCard"]["rooms"] | undefined
}) {
  const { t } = useTranslation()
  const offers = useRoomOffers(hotelId, stay)
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section className={styles.screen} data-rooms-screen aria-labelledby={`${hotelId}-rooms-title`}>
      <div className={styles.screenHead}>
        <Button ref={back} variant="ghost" size="compact" icon="chevron-left" onClick={onBack}>
          {t("explore:roomsScreen.back")}
        </Button>
        <p id={`${hotelId}-rooms-title`} className={styles.screenTitle}>
          {t("explore:roomsScreen.title")}
        </p>
        <p className={styles.screenHotel} lang="ru">
          {hotelName}
        </p>
      </div>
      <StayFields control={offers.control} />
      <OfferState
        request={offerRequest(offers.result, offers.catalog, offers.dated)}
        status={offers.status ? STATUS[offers.status] : undefined}
        sandbox={Boolean(offers.current?.sandbox)}
        partial={Boolean(offers.priced && !offers.priced.rates_complete)}
      />
      {!offers.rooms.length && hotelRooms.length ? <RoomList rooms={hotelRooms} /> : null}
      {offers.rooms.length ? (
        <RoomCatalog
          key={`${hotelId}:${offers.stayKey}`}
          hotelId={hotelId}
          rooms={offers.rooms}
          content={offers.priced}
        />
      ) : null}
      {offers.rooms.length && hotelRooms.length ? (
        <Disclosure title={t("explore:details.rooms")}>
          <RoomList rooms={hotelRooms} />
        </Disclosure>
      ) : null}
    </section>
  )
}
