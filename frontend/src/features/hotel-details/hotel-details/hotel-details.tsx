import { clsx } from "clsx"
import { useId } from "react"
import { useHotel, useHotelDetails } from "@/entities/hotel"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import { HotelHero } from "../hotel-hero/hotel-hero"
import { HotelCardPanels } from "../panels/hotel-card-panels"
import { RoomsScreen } from "../rooms/rooms-screen"
import { useRoomsScreen } from "../rooms/use-rooms-screen"
import styles from "./hotel-details.module.css"

export interface HotelDetailsProps {
  readonly hotelId: string | undefined
  readonly matched?: readonly MatchedProperty[]
  readonly stay?: components["schemas"]["SearchResponse"]["parsed"] | undefined
  readonly onProperty?: ((property: MatchedProperty) => void) | undefined
  readonly onFact: (fact: FactBrief) => void
  readonly onPreview?: ((property: MatchedProperty | undefined) => void) | undefined
  readonly className?: string | undefined
}

function DetailsSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton shape="block" className={styles.skeletonThumb} />
      <Skeleton lines={3} />
      <Skeleton lines={4} className={styles.skeletonWide} />
    </div>
  )
}

function RoomsDock({
  available,
  onOpen,
}: {
  readonly available: boolean
  readonly onOpen: () => void
}) {
  const { t } = useTranslation()
  if (!available) return null
  return (
    <div className={styles.dock}>
      <Button icon="calendar" onClick={onOpen}>
        {t("explore:offers.viewRooms")}
      </Button>
    </div>
  )
}

export function HotelDetails({
  hotelId,
  matched = [],
  stay,
  onProperty,
  onFact,
  onPreview,
  className,
}: HotelDetailsProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const hotel = useHotel(hotelId)
  const catalog = useHotelDetails(hotelId)
  const supplier = catalog.data?.details ?? undefined
  const roomsScreen = useRoomsScreen(hotelId)
  if (!hotelId)
    return (
      <EmptyState
        icon="building"
        title={t("explore:details.empty")}
        description={t("explore:details.emptyText")}
        className={className}
      />
    )
  if (hotel.isPending) return <DetailsSkeleton />
  if (hotel.isError)
    return (
      <ErrorState
        title={t("explore:details.error")}
        onRetry={() => void hotel.refetch()}
        retryPending={hotel.isFetching}
        className={className}
      />
    )
  const card = hotel.data
  if (roomsScreen.open)
    return (
      <article ref={roomsScreen.top} className={clsx(styles.details, className)}>
        <RoomsScreen
          hotelId={card.hotel.id}
          hotelName={card.hotel.name}
          stay={stay}
          onBack={roomsScreen.hide}
          hotelRooms={card.rooms}
        />
      </article>
    )
  return (
    <article
      ref={roomsScreen.top}
      className={clsx(styles.details, className)}
      aria-labelledby={titleId}
      data-motion="fade"
    >
      <HotelHero
        hotel={card.hotel}
        supplier={supplier}
        source={catalog.data?.source}
        titleId={titleId}
        compact
      />
      <HotelCardPanels
        key={card.hotel.id}
        card={card}
        supplier={supplier}
        matched={matched}
        stay={stay}
        onProperty={onProperty}
        onFact={onFact}
        onPreview={onPreview}
        onRooms={roomsScreen.show}
      />
      <RoomsDock available={catalog.data?.status === "available"} onOpen={roomsScreen.show} />
    </article>
  )
}
